import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, X, Check, Copy } from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import useQuery from "@/hooks/useQuery";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import Barcode from "react-barcode";

export default function CreditSaleInvoice({
  invoiceData: propInvoiceData,
  business: propBusiness,
  customer: propCustomer,
  date: propDate,
  customPricing = false,
  customPrices = {},
  customerCopyEnabled: propCustomerCopyEnabled = false,
  customerCopyPrices: propCustomerCopyPrices = {},
  setCustomerCopyPrices: propSetCustomerCopyPrices,
  taxes: propTaxes = [],
  discount: propDiscount = null,
  customerCopyTaxesData: propCustomerCopyTaxes = [],
  customerCopyDiscountData: propCustomerCopyDiscount = null,
  copyLabel = "",
  showCustomerCopyActions = true,
  enableInlineCustomerCopyPreview = true,
  showPrintButton = true,
  warehouseDualSignature = false,
  onConfirm,
  onCancel,
  onApplyCustomerCopy,
  onCustomerCopySaved,
}) {
  const query = useQuery();
  const invoiceRef = useRef(null);
  const saleCode =
    typeof window !== "undefined" && query ? query.get("sale_code") : null;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [customerCopyEnabled, setCustomerCopyEnabled] = useState(
    propCustomerCopyEnabled
  );
  const [customerCopyPrices, setCustomerCopyPrices] = useState(
    propCustomerCopyPrices
  );
  const [showCustomerCopyModal, setShowCustomerCopyModal] = useState(false);
  const [customerCopyTaxes, setCustomerCopyTaxes] = useState(
    propCustomerCopyTaxes.length ? propCustomerCopyTaxes : propTaxes
  );
  const [customerCopyDiscount, setCustomerCopyDiscount] = useState(
    propCustomerCopyDiscount || propDiscount
  );
  const [fetchedInvoice, setFetchedInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [isSavingCustomerCopy, setIsSavingCustomerCopy] = useState(false);

  const isInlineLoading = !propInvoiceData && loadingInvoice && !fetchedInvoice;
  const defaultAuthorizationUser = {
    name: "Admin User",
    id: "4",
    signature: null,
  };
  useEffect(() => {
    setCustomerCopyEnabled(propCustomerCopyEnabled);
  }, [propCustomerCopyEnabled]);

  useEffect(() => {
    setCustomerCopyTaxes(
      propCustomerCopyTaxes.length ? propCustomerCopyTaxes : propTaxes
    );
  }, [propCustomerCopyTaxes, propTaxes]);

  useEffect(() => {
    setCustomerCopyDiscount(propCustomerCopyDiscount || propDiscount);
  }, [propCustomerCopyDiscount, propDiscount]);

  useEffect(() => {
    if (propInvoiceData || !saleCode || !activeBusiness?.id) {
      return;
    }
    setLoadingInvoice(true);
    _fetchApi(
      `/api/v1/transactions/get-sale?sale_code=${saleCode}&facility_id=${activeBusiness.id}`,
      (res) => {
        if (res.success && res.data) {
          setFetchedInvoice(res.data);
        } else if (res.message) {
          toast.error(res.message);
        }
        setLoadingInvoice(false);
      },
      (err) => {
        console.error("Error fetching sale:", err);
        toast.error("Error fetching sale");
        setLoadingInvoice(false);
      }
    );
  }, [saleCode, activeBusiness?.id, propInvoiceData]);

  useEffect(() => {
    if (!fetchedInvoice) return;
    if (Array.isArray(fetchedInvoice.taxes) && fetchedInvoice.taxes.length) {
      const subtotal = fetchedInvoice.subtotal || 0;
      const mappedTaxes = fetchedInvoice.taxes.map((tax) => {
        const computedRate =
          subtotal > 0
            ? Number(((tax.amount || 0) / subtotal) * 100).toFixed(2)
            : undefined;
        return {
          description: tax.description || "Sales Tax",
          rate: tax.rate ?? computedRate,
          tax_type: tax.tax_type || "Sales Tax",
          amount: tax.amount,
          inclusive_type: tax.inclusive_type || (tax.tax_type === "inclusive" ? "inclusive" : "exclusive"),
        };
      });
      setCustomerCopyTaxes(mappedTaxes);
    }
    if (fetchedInvoice.discount_amount) {
      setCustomerCopyDiscount({
        discount_name: "Discount",
        discount_type: "Fixed",
        type: "fixed",
        value: fetchedInvoice.discount_amount,
      });
    }
  }, [fetchedInvoice]);

  const business = propBusiness || activeBusiness;
  const invoice = fetchedInvoice || propInvoiceData;

  const customer = fetchedInvoice?.customer || propCustomer;
  const invoiceUser = fetchedInvoice?.user || propInvoiceData?.user;
  const user = invoiceUser;
  const items = useMemo(
    () => (Array.isArray(invoice.items) ? invoice.items : []),
    [invoice.items]
  );

  const isServiceLineItem = (item) => {
    const type = String(item?.type || "").toLowerCase();
    const itemType = String(item?.item_type || "").toLowerCase();
    if (type.includes("service") || itemType === "service") {
      return true;
    }
    const label = `${item?.item_name || ""} ${item?.description || ""}`.toLowerCase();
    return (
      label.includes("handling & transport") ||
      label.includes("handling and transport") ||
      (label.includes("handling") && label.includes("transport")) ||
      label.includes("service charge") ||
      label.includes("delivery charge")
    );
  };

  const isDeliveryLineItem = (item) => {
    if (isServiceLineItem(item)) return false;
    const entryType = String(item?.type || "").toLowerCase();
    if (entryType.includes("tax") || entryType.includes("discount")) {
      return false;
    }
    return (
      entryType.includes("sales") ||
      entryType.includes("purchase") ||
      entryType.includes("pro-bono")
    );
  };

  const deliveryOrderItems = useMemo(() => {
    const source =
      Array.isArray(invoice.deliveryItems) && invoice.deliveryItems.length > 0
        ? invoice.deliveryItems
        : items;
    return source.filter((item) => isDeliveryLineItem(item));
  }, [invoice.deliveryItems, items]);

  useEffect(() => {
    if (Array.isArray(propCustomerCopyPrices)) {
      setCustomerCopyPrices(propCustomerCopyPrices);
      return;
    }

    if (
      propCustomerCopyPrices &&
      typeof propCustomerCopyPrices === "object" &&
      propCustomerCopyPrices !== null
    ) {
      const mapped = items.map((item, index) => {
        if (propCustomerCopyPrices[index] !== undefined) {
          return Number(propCustomerCopyPrices[index]) || 0;
        }
        if (
          item &&
          item.id !== undefined &&
          propCustomerCopyPrices[item.id] !== undefined
        ) {
          return Number(propCustomerCopyPrices[item.id]) || 0;
        }
        return Number(item?.selling_price) || 0;
      });
      setCustomerCopyPrices(mapped);
      return;
    }

    setCustomerCopyPrices([]);
  }, [items, propCustomerCopyPrices]);

  const authorizationUser =
    user || items.find((item) => item.user)?.user || defaultAuthorizationUser;
  // Calculations
  const resolveCustomerPrice = useCallback(
    (item, index) => {
      if (Array.isArray(customerCopyPrices)) {
        if (customerCopyPrices[index] !== undefined) {
          return Number(customerCopyPrices[index]) || 0;
        }
      } else if (
        customerCopyPrices &&
        typeof customerCopyPrices === "object" &&
        customerCopyPrices !== null
      ) {
        if (customerCopyPrices[index] !== undefined) {
          return Number(customerCopyPrices[index]) || 0;
        }
        if (
          item &&
          item.id !== undefined &&
          customerCopyPrices[item.id] !== undefined
        ) {
          return Number(customerCopyPrices[item.id]) || 0;
        }
      }
      return Number(item?.selling_price) || 0;
    },
    [customerCopyPrices]
  );

  const customerCopyPriceList = useMemo(
    () => items.map((item, index) => resolveCustomerPrice(item, index)),
    [items, resolveCustomerPrice]
  );

  // Get VAT policy from business
  const vatPolicy =
    business?.vat_policy || activeBusiness?.vat_policy || "vat_exclusive";
  const isInclusiveTax = vatPolicy === "vat_inclusive";

  // Step 1: Calculate gross selling price (subtotal) - all items
  const subtotal =
    invoice.subtotal ??
    items.reduce((sum, item) => {
      const price =
        customPricing && customPrices[item.id] !== undefined
          ? customPrices[item.id]
          : item.selling_price;
      return sum + price * (item.quantity_sold || 0);
    }, 0);

  // Step 2: Calculate discount on gross selling price (BEFORE VAT)
  const discountAmount =
    invoice.discount_amount ??
    (propDiscount
      ? propDiscount.discount_type === "Percentage" ||
        propDiscount.type === "percentage"
        ? (subtotal * parseFloat(propDiscount.value)) / 100
        : parseFloat(propDiscount.value)
      : 0);

  // Step 3: Calculate net amount after discount
  const netAmountAfterDiscount = subtotal - discountAmount;

  // Step 4: Calculate taxable subtotal (only from taxable items)
  const taxableSubtotal = items.reduce((sum, item) => {
    const isTaxable = item.taxable === "Taxable";
    if (!isTaxable) return sum;
    const price =
      customPricing && customPrices[item.id] !== undefined
        ? customPrices[item.id]
        : item.selling_price;
    return sum + price * (item.quantity_sold || 0);
  }, 0);

  // Step 5: Calculate discount on taxable items (proportional)
  const taxableDiscount =
    subtotal > 0 ? (discountAmount * taxableSubtotal) / subtotal : 0;

  // Step 6: Calculate taxable net amount (after discount)
  const taxableNetAmount = taxableSubtotal - taxableDiscount;

  // Step 7: Calculate VAT based on VAT policy (only on taxable items)
  let totalTax = 0;

  if (invoice.totalTax !== undefined || invoice.tax_amount !== undefined) {
    // Use tax from invoice if available
    totalTax = invoice.totalTax ?? invoice.tax_amount ?? 0;
  } else if (propTaxes && propTaxes.length > 0) {
    // Calculate tax from taxes array
    if (vatPolicy === "all") {
      // Handle mixed taxes: separate inclusive and exclusive
      const inclusiveTaxes = propTaxes.filter((tax) =>
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
      );
      const exclusiveTaxes = propTaxes.filter((tax) =>
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
      );

      // For inclusive taxes: Extract VAT from taxable amount AFTER discount (37,000 → 2,581.40)
      if (inclusiveTaxes.length > 0 && taxableNetAmount > 0) {
        const inclusiveTaxRate = inclusiveTaxes.reduce((sum, tax) => {
          return sum + (parseFloat(tax.rate) || 0);
        }, 0);
        if (inclusiveTaxRate > 0) {
          totalTax += (taxableNetAmount * inclusiveTaxRate) / (100 + inclusiveTaxRate);
        }
      }

      // For exclusive taxes: Calculate VAT on taxable net amount (after discount)
      if (exclusiveTaxes.length > 0 && taxableNetAmount > 0) {
        totalTax += exclusiveTaxes.reduce((sum, tax) => {
          return sum + (taxableNetAmount * (parseFloat(tax.rate) || 0)) / 100;
        }, 0);
      }
    } else if (isInclusiveTax) {
      // For inclusive: Extract VAT from taxable amount AFTER discount (37,000 → 2,581.40)
      const totalTaxRate = propTaxes.reduce((sum, tax) => {
        return sum + (parseFloat(tax.rate) || 0);
      }, 0);

      if (totalTaxRate > 0 && taxableNetAmount > 0) {
        totalTax = (taxableNetAmount * totalTaxRate) / (100 + totalTaxRate);
      }
    } else {
      // For exclusive: Calculate VAT on taxable net amount (after discount)
      if (taxableNetAmount > 0) {
        totalTax = propTaxes.reduce((sum, tax) => {
          return sum + (taxableNetAmount * (parseFloat(tax.rate) || 0)) / 100;
        }, 0);
      }
    }
  }

  // Step 8: Calculate total amount (grand total) based on VAT policy
  // This must match the cart calculation in MakeSale.jsx
  let totalAmount = 0;
  if (vatPolicy === "all" && propTaxes && propTaxes.length > 0) {
    // Handle mixed taxes: separate inclusive and exclusive
    const inclusiveTaxes = propTaxes.filter((tax) =>
      tax.inclusive_type === "inclusive" ||
      (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
    );
    const exclusiveTaxes = propTaxes.filter((tax) =>
      tax.inclusive_type === "exclusive" ||
      (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
    );

    // Calculate exclusive VAT only (inclusive VAT is already in subtotal)
    let exclusiveVAT = 0;
    if (exclusiveTaxes.length > 0 && taxableNetAmount > 0) {
      exclusiveVAT = exclusiveTaxes.reduce((sum, tax) => {
        return sum + (taxableNetAmount * (parseFloat(tax.rate) || 0)) / 100;
      }, 0);
    }

    // Grand total = Subtotal - Discount + Exclusive VAT
    // (Inclusive VAT is already part of subtotal, so we don't add it)
    totalAmount = netAmountAfterDiscount + exclusiveVAT;
  } else if (isInclusiveTax) {
    // For inclusive: Total = Subtotal - Discount (VAT is already included in prices)
    // This matches: return subtotal - discountAmount; in MakeSale.jsx
    totalAmount = subtotal - discountAmount;
  } else {
    // For exclusive: Total = Subtotal - Discount + VAT
    // This matches: return subtotal - discountAmount + tax; in MakeSale.jsx
    totalAmount = netAmountAfterDiscount + totalTax;
  }

  // Only use invoice total if it's explicitly provided and we want to trust backend
  // Otherwise, recalculate to match cart
  if (invoice.totalAmount !== undefined || invoice.total_amount !== undefined) {
    const invoiceTotal = invoice.totalAmount ?? invoice.total_amount ?? 0;
    // Use calculated total to ensure it matches cart, but log if there's a discrepancy
    if (Math.abs(invoiceTotal - totalAmount) > 0.01) {
      console.warn(
        `Invoice total mismatch: Backend=${invoiceTotal}, Calculated=${totalAmount}. Using calculated value.`
      );
    }
    // Use calculated total to match cart
    // totalAmount = invoiceTotal; // Commented out to use calculated value
  }

  const handleCustomerCopyPriceChange = useCallback(
    (itemIndex, newPrice) => {
      setCustomerCopyPrices((prev) => {
        let next;

        if (Array.isArray(prev)) {
          next = [...prev];
        } else if (prev && typeof prev === "object" && prev !== null) {
          next = items.map((item, index) => {
            if (prev[index] !== undefined) {
              return Number(prev[index]) || 0;
            }
            if (item && item.id !== undefined && prev[item.id] !== undefined) {
              return Number(prev[item.id]) || 0;
            }
            return Number(item?.selling_price) || 0;
          });
        } else {
          next = items.map((item) => Number(item?.selling_price) || 0);
        }

        next[itemIndex] = Number(newPrice) || 0;
        if (typeof propSetCustomerCopyPrices === "function") {
          propSetCustomerCopyPrices(next);
        }
        return next;
      });
    },
    [items, propSetCustomerCopyPrices]
  );

  // Calculate customer copy: Step 1 - Gross selling price
  const customerCopySubtotal = customerCopyPriceList.reduce(
    (sum, price, index) => {
      const quantity = items[index]?.quantity_sold || 0;
      return sum + price * quantity;
    },
    0
  );

  // Calculate customer copy: Step 2 - Discount on gross selling price
  const customerCopyDiscountAmount = customerCopyDiscount
    ? customerCopyDiscount.discount_type === "Percentage" ||
      customerCopyDiscount.type === "percentage"
      ? (customerCopySubtotal * parseFloat(customerCopyDiscount.value)) / 100
      : parseFloat(customerCopyDiscount.value)
    : 0;

  // Calculate customer copy: Step 3 - Net amount after discount
  const customerCopyNetAmountAfterDiscount =
    customerCopySubtotal - customerCopyDiscountAmount;

  // Calculate customer copy: Step 4 - Taxable subtotal (only from taxable items)
  const customerCopyTaxableSubtotal = customerCopyPriceList.reduce(
    (sum, price, index) => {
      const item = items[index];
      const isTaxable = item?.taxable === "Taxable";
      if (!isTaxable) return sum;
      const quantity = item?.quantity_sold || 0;
      return sum + price * quantity;
    },
    0
  );

  // Calculate customer copy: Step 5 - Discount on taxable items (proportional)
  const customerCopyTaxableDiscount =
    customerCopySubtotal > 0
      ? (customerCopyDiscountAmount * customerCopyTaxableSubtotal) /
        customerCopySubtotal
      : 0;

  // Calculate customer copy: Step 6 - Taxable net amount (after discount)
  const customerCopyTaxableNetAmount =
    customerCopyTaxableSubtotal - customerCopyTaxableDiscount;

  // Calculate customer copy: Step 7 - VAT based on VAT policy (only on taxable items)
  let customerCopyTaxAmount = 0;

  if (customerCopyTaxes && customerCopyTaxes.length > 0) {
    if (vatPolicy === "all") {
      // Handle mixed taxes: separate inclusive and exclusive
      const inclusiveTaxes = customerCopyTaxes.filter((tax) =>
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
      );
      const exclusiveTaxes = customerCopyTaxes.filter((tax) =>
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
      );

      // For inclusive taxes: Extract VAT from subtotal (before discount) since subtotal includes VAT
      if (inclusiveTaxes.length > 0 && customerCopyTaxableSubtotal > 0) {
        const inclusiveTaxRate = inclusiveTaxes.reduce((sum, tax) => {
          return sum + (parseFloat(tax.rate) || 0);
        }, 0);
        if (inclusiveTaxRate > 0) {
          // Extract VAT from subtotal: VAT = subtotal × rate / (100 + rate)
          customerCopyTaxAmount += (customerCopyTaxableSubtotal * inclusiveTaxRate) / (100 + inclusiveTaxRate);
        }
      }

      // For exclusive taxes: Calculate VAT on taxable net amount (after discount)
      if (exclusiveTaxes.length > 0 && customerCopyTaxableNetAmount > 0) {
        customerCopyTaxAmount += exclusiveTaxes.reduce((sum, tax) => {
          return sum + (customerCopyTaxableNetAmount * (parseFloat(tax.rate) || 0)) / 100;
        }, 0);
      }
    } else if (isInclusiveTax) {
      // For inclusive: Extract VAT from subtotal (before discount) since subtotal includes VAT
      // Formula: VAT = subtotal × rate / (100 + rate)
      const totalTaxRate = customerCopyTaxes.reduce((sum, tax) => {
        return sum + (parseFloat(tax.rate) || 0);
      }, 0);

      if (totalTaxRate > 0 && customerCopyTaxableSubtotal > 0) {
        // Extract VAT from subtotal: VAT = subtotal × rate / (100 + rate)
        customerCopyTaxAmount =
          (customerCopyTaxableSubtotal * totalTaxRate) / (100 + totalTaxRate);
      }
    } else {
      // For exclusive: Calculate VAT on taxable net amount (after discount)
      if (customerCopyTaxableNetAmount > 0) {
        customerCopyTaxAmount = customerCopyTaxes.reduce((sum, tax) => {
          return (
            sum +
            (customerCopyTaxableNetAmount * (parseFloat(tax.rate) || 0)) / 100
          );
        }, 0);
      }
    }
  }

  // Calculate customer copy: Step 8 - Total (grand total) based on VAT policy
  // This must match the cart calculation in MakeSale.jsx
  let customerCopyTotalAmount = 0;
  if (vatPolicy === "all" && customerCopyTaxes && customerCopyTaxes.length > 0) {
    // Handle mixed taxes: separate inclusive and exclusive
    const inclusiveTaxes = customerCopyTaxes.filter((tax) =>
      tax.inclusive_type === "inclusive" ||
      (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
    );
    const exclusiveTaxes = customerCopyTaxes.filter((tax) =>
      tax.inclusive_type === "exclusive" ||
      (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
    );

    // Calculate exclusive VAT only (inclusive VAT is already in subtotal)
    let exclusiveVAT = 0;
    if (exclusiveTaxes.length > 0 && customerCopyTaxableNetAmount > 0) {
      exclusiveVAT = exclusiveTaxes.reduce((sum, tax) => {
        return sum + (customerCopyTaxableNetAmount * (parseFloat(tax.rate) || 0)) / 100;
      }, 0);
    }

    // Grand total = Subtotal - Discount + Exclusive VAT
    // (Inclusive VAT is already part of subtotal, so we don't add it)
    customerCopyTotalAmount = customerCopyNetAmountAfterDiscount + exclusiveVAT;
  } else if (isInclusiveTax) {
    // For inclusive: Total = Subtotal - Discount (VAT is already included)
    // This matches: return subtotal - discountAmount; in MakeSale.jsx
    customerCopyTotalAmount = customerCopySubtotal - customerCopyDiscountAmount;
  } else {
    // For exclusive: Total = Subtotal - Discount + VAT
    // This matches: return subtotal - discountAmount + tax; in MakeSale.jsx
    customerCopyTotalAmount =
      customerCopyNetAmountAfterDiscount + customerCopyTaxAmount;
  }

  const customerCopyItemsPayload = useMemo(
    () =>
      items.map((item, index) => {
        const price = customerCopyPriceList[index];
        const quantity = item?.quantity_sold || 0;
        const amount = price * quantity;
        return {
          id: item?.id,
          entry_id: item?.entry_id,
          link_id: item?.link_id,
          item_name: item?.item_name,
          description: item?.description,
          item_type: item?.item_type,
          uom_category: item?.uom_category,
          type: item?.type,
          quantity_sold: quantity,
          selling_price: price,
          amount,
          original_price: Number(item?.selling_price || 0),
          original_amount:
            Number(item?.selling_price || 0) * (item?.quantity_sold || 0),
        };
      }),
    [customerCopyPriceList, items]
  );

  const getItemQuantity = (item) =>
    Number(
      item?.quantity_sold ??
        item?.quantity ??
        item?.qty_out ??
        item?.qty_in ??
        0,
    ) || 0;

  const totalCylinders = deliveryOrderItems.reduce(
    (sum, item) => sum + getItemQuantity(item),
    0,
  );

  const formatNumber = (num) => {
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const invoiceDateValue =
    invoice.transaction?.date || invoice.date || propDate;

  const invoiceReference =
    invoice.transaction?.id ||
    invoice.transaction?.reference ||
    saleCode ||
    "N/A";
  const handleReactToPrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `Invoice-${invoiceReference}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 0 !important;
      }
      html, body {
        width: 210mm;
        min-height: 297mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .invoice-container {
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        max-height: 297mm !important;
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        background: #fff !important;
        overflow: hidden !important;
      }
      .invoice-page {
        display: flex !important;
        flex-direction: column !important;
        height: 297mm !important;
        min-height: 297mm !important;
      }
      .invoice-page-half {
        flex: 1 1 50% !important;
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }
      .invoice-page-half-fill {
        flex: 1 1 auto !important;
        min-height: 0.5rem !important;
      }
      .invoice-page-divider {
        flex-shrink: 0 !important;
      }
      .border-dashed { border-style: dashed !important; }
      .no-print { display: none !important; }
    `,
    onBeforeGetContent: () => {
      return new Promise((resolve) => {
        if (!invoiceRef.current) {
          toast.error("Invoice content is not ready to print yet.");
          resolve();
          return;
        }
        // Small delay to ensure DOM is fully rendered
        setTimeout(() => {
          resolve();
        }, 100);
      });
    },
    onPrintError: (error) => {
      console.error("Print failed:", error);
      toast.error("Unable to print invoice. Please try again.");
    },
  });

  const handlePrint = useCallback(() => {
    if (!invoiceRef.current) {
      toast.error("Invoice content is not ready to print yet.");
      return;
    }

    try {
      handleReactToPrint(() => invoiceRef.current);
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Unable to print invoice. Please try again.");
    }
  }, [handleReactToPrint]);

  const saveCustomerCopyDefault = useCallback(async () => {
    if (!activeBusiness?.id || !customer?.customerNo) {
      toast.error("Cannot save customer copy: missing facility or customer.");
      return;
    }

    try {
      setIsSavingCustomerCopy(true);

      const payload = {
        facilityId: activeBusiness.id,
        customerNo: customer.customerNo,
        reference_id: invoiceReference,
        created_by: currentUser?.id || currentUser?.userId,
        data: customerCopyItemsPayload,
      };

      await new Promise((resolve, reject) => {
        _postApi(
          "/api/v1/transactions/customer-copy",
          payload,
          (response) => resolve(response),
          (err) => reject(err)
        );
      });

      toast.success("Customer copy saved");
      if (typeof onCustomerCopySaved === "function") {
        await Promise.resolve(onCustomerCopySaved());
      }
      if (saleCode && activeBusiness?.id) {
        _fetchApi(
          `/api/v1/transactions/get-sale?sale_code=${saleCode}&facility_id=${activeBusiness.id}`,
          (res) => {
            if (res.success && res.data) {
              setFetchedInvoice(res.data);
            }
          },
          (err) => {
            console.error("Failed to refresh sale", err);
          }
        );
      }
      if (enableInlineCustomerCopyPreview) {
        setCustomerCopyEnabled(true);
      }
      setShowCustomerCopyModal(false);
    } catch (error) {
      console.error("Failed to save customer copy:", error);
      toast.error("Failed to save customer copy");
    } finally {
      setIsSavingCustomerCopy(false);
    }
  }, [
    activeBusiness,
    customer,
    invoiceReference,
    currentUser,
    customerCopyItemsPayload,
    saleCode,
    enableInlineCustomerCopyPreview,
    onCustomerCopySaved,
  ]);

  const handleApplyCustomerCopy = useCallback(async () => {
    if (typeof onApplyCustomerCopy === "function") {
      try {
        setIsSavingCustomerCopy(true);
        await onApplyCustomerCopy({
          invoiceReference,
          customerCopyItems: customerCopyItemsPayload,
          business: activeBusiness,
          customer,
          currentUser,
        });
        if (typeof onCustomerCopySaved === "function") {
          await Promise.resolve(onCustomerCopySaved());
        }
        setShowCustomerCopyModal(false);
      } catch (error) {
        console.error("Failed to apply customer copy via callback:", error);
        toast.error("Failed to save customer copy");
      } finally {
        setIsSavingCustomerCopy(false);
      }
      return;
    }

    await saveCustomerCopyDefault();
  }, [
    onApplyCustomerCopy,
    invoiceReference,
    customerCopyItemsPayload,
    activeBusiness,
    customer,
    currentUser,
    saveCustomerCopyDefault,
    onCustomerCopySaved,
  ]);

  const resolvedTaxes = fetchedInvoice ? customerCopyTaxes : propTaxes;

  const renderSkeletonFrame = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
          <div className="h-10 bg-gray-200 animate-pulse rounded" />
          <div className="h-6 bg-gray-200 animate-pulse rounded w-3/4" />
          <div className="h-6 bg-gray-200 animate-pulse rounded w-2/3" />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
          <div className="h-6 bg-gray-200 animate-pulse rounded w-1/2" />
          <div className="grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, idx) => (
              <div
                key={idx}
                className="h-4 bg-gray-200 animate-pulse rounded"
              />
            ))}
          </div>
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="h-12 bg-gray-200 animate-pulse rounded" />
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
          <div className="h-6 bg-gray-200 animate-pulse rounded w-1/3" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className="h-20 bg-gray-200 animate-pulse rounded"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isInlineLoading) {
    return renderSkeletonFrame();
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white print:min-h-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .invoice-container {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: hidden !important;
          }
          .invoice-page {
            display: flex !important;
            flex-direction: column !important;
            height: 297mm !important;
            min-height: 297mm !important;
          }
          .invoice-page-half {
            flex: 1 1 50% !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          .invoice-page-half-fill {
            flex: 1 1 auto !important;
          }
          @page {
            margin: 0mm;
            size: A4;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .border-dashed {
            border-style: dashed !important;
          }
        }
      `}</style>

      {/* Action Buttons */}
      {(showCustomerCopyActions || showPrintButton) && (
        <div className="max-w-5xl mx-auto mb-3 flex flex-wrap gap-2 items-center justify-between no-print">
          {showCustomerCopyActions ? (
            <button
              onClick={onCancel}
              className="px-3 py-0.5 text-sm  bg-red-600 text-white rounded flex items-center gap-1 hover:bg-gray-700 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2 ml-auto">
            {showCustomerCopyActions && onCancel && (
              <button
                onClick={() => setShowCustomerCopyModal(true)}
                className="px-3 py-0.5 text-sm bg-gray-100 text-gray-700 rounded flex items-center gap-1 hover:bg-gray-200 transition-colors border border-gray-300"
              >
                <Copy size={14} />
                While Copy
              </button>
            )}
            {showPrintButton && (
              <button
                onClick={handlePrint}
                className="px-3 py-0.5 text-sm bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
              >
                <Printer size={14} /> Print
              </button>
            )}
            {showCustomerCopyActions && onConfirm && (
              <button
                onClick={onConfirm}
                className="px-3 py-0.5 text-sm bg-green-600 text-white rounded flex items-center gap-1 hover:bg-green-700 transition-colors"
              >
                <Check size={14} /> Confirm Sale
              </button>
            )}
          </div>
        </div>
      )}

      {/* Invoice Container */}

      <div
        ref={invoiceRef}
        className="max-w-5xl mx-auto bg-white shadow-sm invoice-container border border-gray-200"
      >
        <div className="invoice-page flex flex-col min-h-[297mm] print:h-[297mm]">
          <section className="invoice-page-half flex flex-col flex-1 min-h-0">
          <BusinessDocumentHeader
            business={business}
            title={`Credit Sale Invoice${copyLabel ? ` • ${copyLabel}` : ""}`}
            numberLabel={`No: ${invoiceReference}`}
            date={invoiceDateValue}
          />

          {/* Invoice Details Grid */}
          <div className="grid gap-1 mb-1">
            <div className="bg-blue-50 border border-blue-200  p-1">
              <h6 className="text-xs font-semibold text-blue-800 mb- uppercase tracking-wide">
                Bill To
              </h6>
              <p className="text-xs text-gray-700 leading-relaxed">
                <span className="font-semibold text-gray-600">
                  Account Name:
                </span>{" "}
                <span className="text-gray-900">{customer.customer_name}</span>{" "}
                <span className="text-gray-400 mx-1">|</span>
                <span className="font-semibold text-gray-600">
                  Account No:
                </span>{" "}
                <span className="text-gray-900">{customer.customerNo}</span>
                {customer.address && (
                  <>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Address:
                    </span>{" "}
                    <span className="text-gray-900">{customer.address}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-1">
            <table className="w-full border-collapse border border-gray-300  overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white">
                  <th className="border-r border-blue-500 px-2 py-1.5 text-center text-xs font-semibold">
                    #
                  </th>
                  <th className="border-r border-blue-500 px-2 py-1.5 text-left text-xs font-semibold">
                    Description / Size
                  </th>
                  <th className="border-r border-blue-500 px-2 py-1.5 text-center text-xs font-semibold">
                    Quantity
                  </th>
                  <th className="border-r border-blue-500 px-2 py-1.5 text-right text-xs font-semibold">
                    Unit Price(₦)
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold">
                    Amount(₦)
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white">
                {items.map((item, index) => {
                  const resolvedCustomPrice = customerCopyPriceList[index];
                  const displayPrice = customerCopyEnabled
                    ? resolvedCustomPrice
                    : item.selling_price;
                  const displayAmount =
                    displayPrice * (item.quantity_sold || 0);

                  return (
                    <tr
                      key={item.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs font-semibold text-gray-600">
                        {index + 1}
                      </td>
                      <td className="border-r border-t border-gray-200 px-2 py-1.5 text-xs">
                        <strong className="text-gray-800">
                          {item.item_name || item.description || "N/A"}
                        </strong>
                        {item.taxable === "Taxable" ? (
                          <span
                            className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                              item.taxable === "Taxable"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {item.taxable}
                          </span>
                        ) : null}
                        {item.unit_of_measure && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({item.unit_of_measure})
                          </span>
                        )}
                      </td>
                      <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs text-gray-700">
                        {formatNumber1(item.quantity_sold)}
                      </td>
                      <td className="border-r border-t border-gray-200 px-2 py-1.5 text-right text-xs text-gray-700">
                        {formatNumber(item.selling_price)}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1.5 text-right text-xs font-semibold text-gray-900">
                        {formatNumber(displayAmount)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan="2"></td>
                  <td className="border-r border-t border-gray-300 px-2 py-1.5 text-center  text-xs font-semibold text-gray-700">
                    <h6>
                      {" "}
                      {formatNumber1(
                        items.reduce(
                          (sum, item) => sum + (item.quantity_sold || 0),
                          0
                        )
                      )}
                    </h6>
                  </td>
                  <td className="border-r border-t border-gray-300 px-2 py-1.5 text-right text-xs font-semibold text-gray-900">
                    <div className="font-semibold text-gray-700">SUBTOTAL:</div>
                  </td>
                  <td className="border-t border-gray-300 px-2 py-1.5 text-right text-xs">
                    <div className="font-bold text-gray-900">
                      {formatNumber(
                        customerCopyEnabled ? customerCopySubtotal : subtotal
                      )}
                    </div>
                  </td>
                </tr>
                {propDiscount && (
                  <tr className="bg-red-50">
                    <td
                      colSpan="4"
                      className="border-r border-t border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-700"
                    >
                      {propDiscount.discount_name || "Discount"} :
                    </td>
                    <td className="border-t border-gray-200 px-2 py-1 text-right text-xs font-semibold text-red-600">
                      -
                      {formatNumber(
                        customerCopyEnabled
                          ? customerCopyDiscountAmount
                          : discountAmount
                      )}
                    </td>
                  </tr>
                )}
                {resolvedTaxes.map((tax, index) => {
                  // Determine if this specific tax is inclusive or exclusive
                  const isTaxInclusive = vatPolicy === "all"
                    ? (tax.inclusive_type === "inclusive" ||
                       (tax.inclusive_type === undefined && tax.tax_type === "inclusive"))
                    : isInclusiveTax;

                  // Calculate tax amount for this specific tax using the tax percentage
                  let taxAmount = 0;
                  if (customerCopyEnabled) {
                    // Customer copy tax calculation
                    if (isTaxInclusive) {
                      // For inclusive: Extract VAT from subtotal (before discount) since subtotal includes VAT
                      // Formula: VAT = subtotal × rate / (100 + rate)
                      const totalTaxRate = customerCopyTaxes
                        .filter((t) => {
                          const tIsInclusive = vatPolicy === "all"
                            ? (t.inclusive_type === "inclusive" ||
                               (t.inclusive_type === undefined && t.tax_type === "inclusive"))
                            : isInclusiveTax;
                          return tIsInclusive;
                        })
                        .reduce((sum, t) => {
                          return sum + (parseFloat(t.rate) || 0);
                        }, 0);
                      if (totalTaxRate > 0 && customerCopyTaxableSubtotal > 0) {
                        const taxRate = parseFloat(tax.rate) || 0;
                        const taxProportion = taxRate / totalTaxRate;
                        // Extract VAT from subtotal (inclusive amount)
                        const totalVAT =
                          (customerCopyTaxableSubtotal * totalTaxRate) /
                          (100 + totalTaxRate);
                        taxAmount = totalVAT * taxProportion;
                      }
                    } else {
                      // For exclusive: Calculate VAT on taxable net amount (after discount)
                      // Formula: VAT = taxable_amount × rate / 100
                      taxAmount =
                        (customerCopyTaxableNetAmount * parseFloat(tax.rate)) /
                        100;
                    }
                  } else {
                    // Main invoice tax calculation
                    if (isTaxInclusive) {
                      // For inclusive: Extract VAT from taxable amount AFTER discount (37,000 → 2,581.40)
                      const totalTaxRate = propTaxes
                        .filter((t) => {
                          const tIsInclusive = vatPolicy === "all"
                            ? (t.inclusive_type === "inclusive" ||
                               (t.inclusive_type === undefined && t.tax_type === "inclusive"))
                            : isInclusiveTax;
                          return tIsInclusive;
                        })
                        .reduce((sum, t) => {
                          return sum + (parseFloat(t.rate) || 0);
                        }, 0);
                      if (totalTaxRate > 0 && taxableNetAmount > 0) {
                        const taxRate = parseFloat(tax.rate) || 0;
                        const taxProportion = taxRate / totalTaxRate;
                        const totalVAT =
                          (taxableNetAmount * totalTaxRate) /
                          (100 + totalTaxRate);
                        taxAmount = totalVAT * taxProportion;
                      }
                    } else {
                      // For exclusive: Calculate VAT on taxable net amount (after discount)
                      // Formula: VAT = taxable_amount × rate / 100
                      taxAmount =
                        (taxableNetAmount * parseFloat(tax.rate)) / 100;
                    }
                  }

                  return (
                    <tr key={index} className="bg-gray-50">
                      <td
                        colSpan="4"
                        className="border-r border-t border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-700"
                      >
                        {tax.description} ({tax.rate}%{" "}
                        {vatPolicy === "all"
                          ? (tax.inclusive_type === "inclusive"
                              ? "Inclusive"
                              : tax.inclusive_type === "exclusive"
                              ? "Exclusive"
                              : tax.tax_type === "inclusive"
                              ? "Inclusive"
                              : "Exclusive")
                          : isInclusiveTax
                          ? "inclusive"
                          : "exclusive"}):
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-900">
                        {formatNumber(
                          taxAmount ||
                            (customerCopyEnabled
                              ? customerCopyTaxAmount
                              : totalTax)
                        )}
                      </td>
                    </tr>
                  );
                })}
                {customerCopyEnabled && (
                  <tr className="bg-gray-100">
                    <td
                      colSpan="4"
                      className="border-r border-t border-gray-300 px-2 py-1.5 text-right text-xs font-semibold text-gray-600"
                    >
                      Original Total:
                    </td>
                    <td className="border-t border-gray-300 px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                      ₦{formatNumber(totalAmount)}
                    </td>
                  </tr>
                )}
                <tr className="bg-gradient-to-r from-green-600 to-green-700 text-white border-t-2 border-green-800">
                  <td
                    colSpan="4"
                    className="border-r border-green-500 px-2 py-2 text-right text-sm font-bold"
                  >
                    GRAND TOTAL:
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-bold">
                    ₦
                    {formatNumber(
                      customerCopyEnabled
                        ? customerCopyTotalAmount
                        : totalAmount
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="invoice-page-half-fill flex-1 min-h-[1rem]" aria-hidden="true" />

          {/* Footer Section */}
          <div className="grid grid-cols-2 gap-2 mb-1 shrink-0">
            <div className="bg-gray-50 border border-gray-200  p-2">
              <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
                Invoice Details
              </h3>
              <p className="text-xs mb-1 text-gray-700">
                <span className="font-semibold">Receipt No:</span>{" "}
                <span className="text-gray-900">{invoiceReference}</span>
              </p>
              {invoiceReference ? (
                <div className="mb-2 flex justify-center overflow-hidden">
                  <Barcode
                    value={String(invoiceReference)}
                    width={1.1}
                    height={32}
                    displayValue={false}
                    margin={0}
                    background="#f9fafb"
                    lineColor="#000000"
                  />
                </div>
              ) : null}
              <p className="text-xs mb-1 text-gray-700">
                <span className="font-semibold">Delivery Order No:</span>{" "}
                <span className="text-gray-900">
                  DO-{invoice.transaction?.id || "N/A"}
                </span>
              </p>
              <p className="text-xs mb-2 text-gray-700">
                <span className="font-semibold">Customer:</span>{" "}
                <span className="text-gray-900">{customer.customer_name}</span>
              </p>
              <div className="border-t-2 border-gray-300 mt-2 pt-1.5">
                {warehouseDualSignature ? (
                  <div className="space-y-3">
                    <div>
                      <div className="h-8 border-b border-gray-400" />
                      <p className="text-xs font-semibold text-gray-600 mt-1">
                        Released by (Warehouse)
                      </p>
                    </div>
                    <div>
                      <div className="h-8 border-b border-gray-400" />
                      <p className="text-xs font-semibold text-gray-600 mt-1">
                        Received by (Customer)
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-gray-600">
                    Customer Signature
                  </p>
                )}
                {/* <div className="h-8"></div> */}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-1.5">
              <h6 className="text-xs font-bold text-gray-800 mb-2 border-b border-blue-300 pb-1">
                {warehouseDualSignature ? "Warehouse Details" : "Prepared Details"}
              </h6>
              <p className="text-xs mb-1.5 text-gray-700">
                <span className="font-semibold">
                  {warehouseDualSignature ? "Printed By:" : "Prepared By:"}
                </span>{" "}
                {user?.name} ({user?.id})
              </p>
              {warehouseDualSignature ? (
                <div className="space-y-3 mt-2">
                  <div>
                    <div className="h-8 border-b border-blue-300" />
                    <p className="text-[0.65rem] text-gray-500 uppercase tracking-wide mt-1">
                      Warehouse signature
                    </p>
                  </div>
                  <div>
                    <div className="h-8 border-b border-blue-300" />
                    <p className="text-[0.65rem] text-gray-500 uppercase tracking-wide mt-1">
                      Checker / dual signature
                    </p>
                  </div>
                </div>
              ) : authorizationUser.signature ? (
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={authorizationUser.signature}
                    alt="Authorized signature"
                    className="h-6 object-contain"
                  />
                  <span className="text-[0.65rem] text-gray-500 uppercase tracking-wide">
                    Signature
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 ">
                  <div className="h-6 "></div>
                  <span className="text-[0.65rem] text-gray-500 uppercase tracking-wide">
                    Signature
                  </span>
                </div>
              )}
              <p className="mt- text-xs font-bold text-center text-blue-800 py-1 bg-blue-100 rounded">
                FOR {business.business_name}
              </p>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-r-4 border-l-4 border-amber-500 p-1 shadow-sm shrink-0 mt-auto">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-2">
                <h6 className="text-xs font-semibold text-amber-900">
                  IMPORTANT NOTE
                </h6>
                <h6 className="text-xs text-amber-800 mt-">
                  The Company will not accept refund claims on Gases or any
                  other goods once they are sold to customers.
                </h6>
              </div>
            </div>
          </div>
          </section>

        {/* Dashed Separator */}
        <div className="invoice-page-divider relative shrink-0 py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-dashed border-gray-400"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-0 text-xs font-semibold text-gray-500 uppercase tracking-wide"></span>
          </div>
        </div>

        {/* Delivery Order Section */}
        <section className="invoice-page-half flex flex-col flex-1 min-h-0 bg-gradient-to-b from-gray-50 to-white">
          <BusinessDocumentHeader
            business={business}
            title={`Delivery Order${copyLabel ? ` • ${copyLabel}` : ""}`}
            numberLabel={`No: DO-${invoiceReference}`}
            date={invoiceDateValue}
          />

          <div className="grid gap-1 mb-1">
            <div className="bg-blue-50 border border-blue-200 p-1 pl-3">
              <p className="text-xs font-semibold text-blue-800 mb-1 uppercase tracking-wide">
                Bill To
              </p>
              <p className="text-xs text-gray-700 leading-relaxed">
                <span className="font-semibold text-gray-600">
                  Account Name:
                </span>{" "}
                <span className="text-gray-900">{customer.customer_name}</span>{" "}
                <span className="text-gray-400 mx-1">|</span>
                <span className="font-semibold text-gray-600">
                  Account No:
                </span>{" "}
                <span className="text-gray-900">{customer.customerNo}</span>
                {customer.address && (
                  <>
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Address:
                    </span>{" "}
                    <span className="text-gray-900">{customer.address}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="mb-1">
            <table className="w-full border-collapse border border-gray-300  overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                  <th className="border-r border-green-500 px-2 py-1.5 text-center text-xs font-semibold">
                    #
                  </th>
                  <th className="border-r border-green-500 px-2 py-1.5 text-left text-xs font-semibold">
                    DESCRIPTION
                  </th>
                  {/* <th className="border-r border-green-500 px-2 py-1.5 text-center text-xs font-semibold">
                    SIZES
                  </th> */}
                  <th className="px-2 py-1.5 text-center text-xs font-semibold">
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {deliveryOrderItems.map((item, index) => (
                    <tr
                      key={item.id ?? item.entry_id ?? index}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border-r border-t border-gray-200 px-2 py-1.5 text-center text-xs font-semibold text-gray-600">
                        {index + 1}
                      </td>
                      <td className="border-r border-t border-gray-200 px-2 py-1.5 text-xs text-gray-800">
                        {item.item_name || item.description || "—"}
                      </td>
                      <td className="border-t border-gray-200 px-2 py-1.5 text-center text-xs text-gray-700">
                        {getItemQuantity(item)}
                      </td>
                    </tr>
                  ))}
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-t-2 border-blue-200">
                  <td
                    colSpan="2"
                    className="border-r border-t border-gray-300 px-2 py-1.5 text-right text-xs font-bold text-gray-800"
                  >
                    Total:
                  </td>
                  <td className="border-t border-gray-300 px-2 py-1.5 text-center text-xs font-bold text-gray-900">
                    {totalCylinders}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="invoice-page-half-fill flex-1 min-h-[1rem]" aria-hidden="true" />

          <div className="grid grid-cols-2 gap-2 mb-1 shrink-0">
            <div className="bg-gray-50 border border-gray-200 p-1.5">
              <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-gray-300 pb-1">
                Delivery Information
              </h3>
              <h6 className="text-xs mb-1 text-gray-700">
                <span className="font-semibold">Vehicle No:</span>{" "}
                ___________________________________
              </h6>
              {/* <p className="text-xs mb-2 text-gray-700">
                <span className="font-semibold">Prepared By:</span> Christiana
              </p> */}
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 ">
                <h6 className="font-semibold text-xs text-blue-900 mb-1">
                  DELIVERED BY STORES OFFICER:
                </h6>
                <h6 className="italic text-xs text-blue-700">
                  Received the above items in good condition
                </h6>
                <div className="mt-2 border-t border-blue-300 pt-2">
                  <p className="text-xs text-gray-600">
                    Signature: ___________________________________
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-green-50 border border-green-200  p-1">
              <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-green-300 pb-1">
                Driver & Authorization
              </h3>
              <p className="text-xs mb-1 text-gray-700">
                <span className="font-semibold">Driver&apos;s Name:</span>{" "}
                _________________________________________________________________
              </p>
              {/* <p className="text-xs mb-2 text-gray-700">
                <span className="font-semibold">Authorized By:</span> Dorcas
              </p> */}
              <div className="mt-3 p-2 bg-white border border-gray-300 ">
                <p className="font-semibold text-xs text-gray-900 mb-2">
                  RECEIVED BY:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Name:</p>
                    <div className="border-b border-gray-400 h-5"></div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Signature:</p>
                    <div className="border-b border-gray-400 h-5"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Notice for Delivery Order */}
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-r-4 border-amber-500 p-0.5 shadow-sm shrink-0 mt-auto">
            <div className="flex items-start gap-1">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-2">
                <h6 className="text-xs font-semibold text-amber-900">
                  IMPORTANT NOTE
                </h6>
                <h6 className="text-xs text-amber-800 mt-">
                  The Company will not accept refund claims on Gases or any
                  other goods once they are sold to customers.
                </h6>
              </div>
            </div>
          </div>
        </section>
        </div>
      </div>

      {/* Customer Copy Modal */}
      {showCustomerCopyActions && showCustomerCopyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Copy size={20} />
                  <div>
                    <h3 className="text-base font-bold">While Copy Pricing</h3>
                    <p className="text-blue-100 text-xs">
                      Adjust pricing, taxes, and discounts for customer-facing
                      invoice
                    </p>
                    {(customerCopyTaxes.length > 0 || customerCopyDiscount) && (
                      <p className="text-blue-200 text-xs mt-0.5">
                        {customerCopyTaxes.length > 0 &&
                          `${customerCopyTaxes.length} tax(es)`}
                        {customerCopyTaxes.length > 0 &&
                          customerCopyDiscount &&
                          " • "}
                        {customerCopyDiscount && "1 discount"}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowCustomerCopyModal(false)}
                  className="p-1 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Items Table */}
              <div className="border border-gray-300 rounded-lg overflow-hidden mb-4">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-3 py-1.5 text-left text-xs font-bold">
                        Description
                      </th>
                      <th className="border border-gray-300 px-3 py-1.5 text-center text-xs font-bold">
                        Quantity
                      </th>

                      <th className="border border-gray-300 px-3 py-1.5 text-right text-xs font-bold">
                        Customer Price
                      </th>
                      <th className="border border-gray-300 px-3 py-1.5 text-right text-xs font-bold">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => {
                      const customerPrice = customerCopyPriceList[index];
                      const customerAmount =
                        customerPrice * (item.quantity_sold || 0);

                      return (
                        <tr
                          key={item.id}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="border border-gray-300 px-3 py-2 text-xs">
                            <strong>{item.item_name}</strong>
                            {item.uom_category && (
                              <div className="text-gray-600 text-xs mt-0.5">
                                {item.uom_category}
                              </div>
                            )}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-xs">
                            {item.quantity_sold}
                          </td>
                          {/* <td className="border border-gray-300 px-3 py-2 text-right text-xs">
                            ₦{formatNumber(item.selling_price)}
                          </td> */}
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={customerPrice}
                              onChange={(e) => {
                                const newPrice =
                                  parseFloat(e.target.value) || 0;
                                handleCustomerCopyPriceChange(index, newPrice);
                              }}
                              className="w-28 px-2 py-0.5 border border-gray-300 rounded text-right text-xs focus:border-purple-500 focus:outline-none"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right text-xs font-semibold">
                            ₦{formatNumber(customerAmount)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr className="bg-gray-100">
                      <td
                        className="border border-gray-300 px-3 py-1.5 text-right text-xs font-semibold"
                        colSpan="3"
                      >
                        TOTAL:
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right text-xs font-semibold">
                        ₦{formatNumber(customerCopySubtotal)}
                      </td>
                    </tr>

                    {customerCopyDiscount && (
                      <tr className="bg-green-50">
                        <td
                          className="border border-gray-300 px-3 py-1.5 text-right text-xs font-semibold"
                          colSpan="3"
                        >
                          {customerCopyDiscount.name ||
                            customerCopyDiscount.discount_name}
                          :
                        </td>
                        <td className="border border-gray-300 px-3 py-1.5 text-right text-xs font-semibold text-red-600">
                          -{formatNumber(customerCopyDiscountAmount)}
                        </td>
                      </tr>
                    )}
                    {customerCopyTaxes.map((tax, index) => {
                      // Determine if this specific tax is inclusive or exclusive
                      const isTaxInclusive = vatPolicy === "all"
                        ? (tax.inclusive_type === "inclusive" ||
                           (tax.inclusive_type === undefined && tax.tax_type === "inclusive"))
                        : isInclusiveTax;

                      let taxAmount = 0;
                      if (isTaxInclusive) {
                        // For inclusive: Extract VAT from subtotal (before discount) since subtotal includes VAT
                        // Formula: VAT = subtotal × rate / (100 + rate)
                        const totalTaxRate = customerCopyTaxes
                          .filter((t) => {
                            const tIsInclusive = vatPolicy === "all"
                              ? (t.inclusive_type === "inclusive" ||
                                 (t.inclusive_type === undefined && t.tax_type === "inclusive"))
                              : isInclusiveTax;
                            return tIsInclusive;
                          })
                          .reduce((sum, t) => {
                            return sum + (parseFloat(t.rate) || 0);
                          }, 0);

                        if (
                          totalTaxRate > 0 &&
                          customerCopyTaxableSubtotal > 0
                        ) {
                          const taxRate = parseFloat(tax.rate) || 0;
                          const taxProportion = taxRate / totalTaxRate;
                          // Extract total VAT from subtotal (inclusive amount)
                          const totalVAT =
                            (customerCopyTaxableSubtotal * totalTaxRate) /
                            (100 + totalTaxRate);
                          // Allocate VAT proportionally to this tax
                          taxAmount = totalVAT * taxProportion;
                        }
                      } else {
                        // For exclusive: Calculate VAT on taxable net amount (after discount)
                        taxAmount =
                          (customerCopyTaxableNetAmount *
                            parseFloat(tax.rate)) /
                          100;
                      }
                      return (
                        <tr key={index} className="bg-blue-50">
                          <td
                            className="border border-gray-300 px-3 py-1.5 text-right text-xs font-semibold"
                            colSpan="3"
                          >
                            {tax.description} {tax.rate}% (
                            {vatPolicy === "all"
                              ? (tax.inclusive_type === "inclusive"
                                  ? "Inclusive"
                                  : tax.inclusive_type === "exclusive"
                                  ? "Exclusive"
                                  : tax.tax_type === "inclusive"
                                  ? "Inclusive"
                                  : "Exclusive")
                              : isInclusiveTax
                              ? "inclusive"
                              : "exclusive"}):
                          </td>
                          <td className="border border-gray-300 px-3 py-1.5 text-right text-xs font-semibold text-blue-600">
                            {formatNumber(taxAmount)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-yellow-100">
                      <td
                        className="border border-gray-300 px-3 py-1.5 text-right text-xs font-bold"
                        colSpan="3"
                      >
                        GRAND TOTAL:
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right text-xs font-bold">
                        ₦{formatNumber(customerCopyTotalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-center">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-bold text-xs mb-1">Total Items</h4>
                    <p className="text-base font-bold text-blue-600">
                      {items.length}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs mb-1">Original Total</h4>
                    <p className="text-base font-bold text-blue-600">
                      ₦{formatNumber(totalAmount)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs mb-1">
                      Customer Copy Total
                    </h4>
                    <p className="text-base font-bold text-blue-600">
                      ₦{formatNumber(customerCopyTotalAmount)}
                    </p>
                  </div>
                </div>
                {customerCopyTotalAmount !== totalAmount && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-xs font-bold text-amber-900 mb-0.5">
                      Pricing Difference
                    </p>
                    <p className="text-xs text-gray-700">
                      Difference: ₦
                      {formatNumber(
                        Math.abs(customerCopyTotalAmount - totalAmount)
                      )}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  onClick={() => setShowCustomerCopyModal(false)}
                  className="px-3 py-0.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-all font-medium"
                  disabled={isSavingCustomerCopy}
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyCustomerCopy}
                  className="px-3 py-0.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded hover:from-blue-700 hover:to-indigo-700 transition-all font-medium flex items-center gap-1 shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isSavingCustomerCopy}
                >
                  {isSavingCustomerCopy ? (
                    <>
                      <span className="h-3 w-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin"></span>
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Apply White Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

CreditSaleInvoice.propTypes = {
  invoiceData: PropTypes.object,
  business: PropTypes.object,
  customer: PropTypes.object,
  date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  customPricing: PropTypes.bool,
  customPrices: PropTypes.object,
  customerCopyEnabled: PropTypes.bool,
  customerCopyPrices: PropTypes.object,
  setCustomerCopyPrices: PropTypes.func,
  taxes: PropTypes.arrayOf(PropTypes.object),
  discount: PropTypes.object,
  customerCopyTaxesData: PropTypes.arrayOf(PropTypes.object),
  customerCopyDiscountData: PropTypes.object,
  copyLabel: PropTypes.string,
  showCustomerCopyActions: PropTypes.bool,
  enableInlineCustomerCopyPreview: PropTypes.bool,
  showPrintButton: PropTypes.bool,
  warehouseDualSignature: PropTypes.bool,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  onApplyCustomerCopy: PropTypes.func,
  onCustomerCopySaved: PropTypes.func,
};
