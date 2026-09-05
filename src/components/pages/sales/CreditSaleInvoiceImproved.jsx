import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer, X, Check } from "lucide-react";
import useQuery from "@/hooks/useQuery";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import BusinessDocumentHeader from "@/components/common/BusinessDocumentHeader";
import Barcode from "react-barcode";
import { isProductTaxable } from "@/utils/taxableStatus";
import { inferTaxInclusiveType } from "@/utils/saleVat";

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
  /** "a4" | "a5" — print page size from business receipt setting */
  paperSize = "a4",
  /** "invoice" | "dispatch" | "both" — Verification Points vs Invoice Separation */
  documentMode = "both",
  onConfirm,
  onCancel,
  onApplyCustomerCopy,
  onCustomerCopySaved,
}) {
  const query = useQuery();
  const invoiceRef = useRef(null);
  const isA5 = String(paperSize || "a4").toLowerCase() === "a5";
  const pageWidthMm = isA5 ? 148 : 210;
  const pageHeightMm = isA5 ? 210 : 297;
  const pageSizeLabel = isA5 ? "A5" : "A4";
  const invoiceBwCss = `
    .invoice-bw,
    .invoice-bw *:not(img):not(svg):not(canvas):not(path) {
      background: #fff !important;
      background-color: #fff !important;
      background-image: none !important;
      color: #000 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }
    .invoice-bw,
    .invoice-bw * {
      border-color: #111 !important;
      -webkit-print-color-adjust: economy !important;
      print-color-adjust: economy !important;
    }
    .invoice-bw img,
    .invoice-bw svg,
    .invoice-bw canvas {
      filter: grayscale(1) contrast(1.2) !important;
    }
  `;
  const saleCode =
    typeof window !== "undefined" && query ? query.get("sale_code") : null;
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const currentUser = useSelector((state) => state.auth.user);
  const [customerCopyEnabled, setCustomerCopyEnabled] = useState(
    propCustomerCopyEnabled,
  );
  const [customerCopyPrices, setCustomerCopyPrices] = useState(
    propCustomerCopyPrices,
  );
  const [customerCopyTaxes, setCustomerCopyTaxes] = useState(
    propCustomerCopyTaxes.length ? propCustomerCopyTaxes : propTaxes,
  );
  const [customerCopyDiscount, setCustomerCopyDiscount] = useState(
    propCustomerCopyDiscount || propDiscount,
  );
  const [fetchedInvoice, setFetchedInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [isSavingCustomerCopy, setIsSavingCustomerCopy] = useState(false);
  /** Customer print view: amount = VAT in unit price; vat = show VAT breakdown */
  const [customerPrintMode, setCustomerPrintMode] = useState("amount");
  /** Invoice print ink: black-and-white by default; Color is opt-in on this screen. */
  const [printInColor, setPrintInColor] = useState(false);

  const isInlineLoading = !propInvoiceData && loadingInvoice && !fetchedInvoice;
  useEffect(() => {
    setCustomerCopyEnabled(propCustomerCopyEnabled);
  }, [propCustomerCopyEnabled]);

  useEffect(() => {
    setCustomerCopyTaxes(
      propCustomerCopyTaxes.length ? propCustomerCopyTaxes : propTaxes,
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
      },
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
          inclusive_type: inferTaxInclusiveType(
            tax,
            subtotal,
            vatPolicy,
          ),
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
  const invoiceCreator =
    fetchedInvoice?.user || propInvoiceData?.user || invoice?.user || null;
  const preparedByName =
    invoiceCreator?.name ||
    [invoiceCreator?.firstname, invoiceCreator?.lastname]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    currentUser?.name ||
    [currentUser?.firstname, currentUser?.lastname].filter(Boolean).join(" ") ||
    "—";
  const preparedById =
    invoiceCreator?.id || currentUser?.id || currentUser?.userId || "";
  const preparedBySignature =
    invoiceCreator?.signature || currentUser?.signature || null;
  const DEFAULT_IMPORTANT_NOTE =
    "Thank you for patronizing us. We look forward to your return and to continuing to do business with you.";
  const configuredImportantNote = [
    invoice?.business?.terms_conditions,
    business?.terms_conditions,
    activeBusiness?.terms_conditions,
  ].find((v) => v !== undefined && v !== null);
  const importantNoteText =
    configuredImportantNote === undefined
      ? DEFAULT_IMPORTANT_NOTE
      : String(configuredImportantNote).trim();
  const showImportantNote =
    configuredImportantNote === undefined ? true : importantNoteText.length > 0;
  const printDeliveryOrderRaw = [
    invoice?.business?.print_delivery_order,
    business?.print_delivery_order,
    activeBusiness?.print_delivery_order,
  ].find((v) => v !== undefined && v !== null);
  const deliveryOrderFormat = String(
    invoice?.business?.delivery_order_format ||
      business?.delivery_order_format ||
      activeBusiness?.delivery_order_format ||
      "match",
  )
    .trim()
    .toLowerCase();
  const deliveryDocumentType = String(
    invoice?.business?.delivery_document_type ||
      business?.delivery_document_type ||
      activeBusiness?.delivery_document_type ||
      "delivery_order",
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const isGoodsIssueNote = deliveryDocumentType === "goods_issue_note";
  const dispatchDocTitle = isGoodsIssueNote
    ? "Goods Issue Note"
    : "Delivery Order";
  const dispatchDocPrefix = isGoodsIssueNote ? "GIN" : "DO";
  const mode = String(documentMode || "both")
    .trim()
    .toLowerCase();
  const showInvoiceSection = mode !== "dispatch";
  const deliveryOrderEnabled =
    printDeliveryOrderRaw === undefined || printDeliveryOrderRaw === null
      ? true
      : !!printDeliveryOrderRaw;
  const showDeliveryOrder =
    mode !== "invoice" &&
    (mode === "dispatch" || deliveryOrderEnabled) &&
    deliveryOrderFormat !== "thermal";
  const items = useMemo(
    () => (Array.isArray(invoice?.items) ? invoice.items : []),
    [invoice?.items],
  );

  const isServiceLineItem = (item) => {
    const type = String(item?.type || "").toLowerCase();
    const itemType = String(item?.item_type || "").toLowerCase();
    if (type.includes("service") || itemType === "service") {
      return true;
    }
    const label =
      `${item?.item_name || ""} ${item?.description || ""}`.toLowerCase();
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
    [customerCopyPrices],
  );

  const customerCopyPriceList = useMemo(
    () => items.map((item, index) => resolveCustomerPrice(item, index)),
    [items, resolveCustomerPrice],
  );

  // Get VAT policy from business
  const vatPolicy =
    business?.vat_policy || activeBusiness?.vat_policy || "vat_exclusive";
  const isInclusiveTax = vatPolicy === "vat_inclusive";
  const showVatOnSalesInvoice =
    (business?.show_vat_on_sales_invoice ??
      activeBusiness?.show_vat_on_sales_invoice) !== false;

  const isItemTaxable = (item) => {
    const flag = String(item?.taxable || "").toLowerCase();
    return (
      flag === "taxable" || flag === "yes" || flag === "true" || flag === "1"
    );
  };

  const isExclusiveTaxRow = (tax) => {
    const kind = inferTaxInclusiveType(
      tax,
      taxableNetAmount > 0 ? taxableNetAmount : subtotal,
      vatPolicy,
    );
    return kind === "exclusive";
  };

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
    invoice.discountAmount ??
    (propDiscount
      ? propDiscount.discount_type === "Percentage" ||
        propDiscount.type === "percentage"
        ? (subtotal * parseFloat(propDiscount.value)) / 100
        : parseFloat(propDiscount.value || propDiscount.amount || 0)
      : 0);

  // Step 3: Calculate net amount after discount
  const netAmountAfterDiscount = subtotal - discountAmount;

  // Step 4: Calculate taxable subtotal (only from taxable items)
  const taxableSubtotal = items.reduce((sum, item) => {
    if (!isItemTaxable(item)) return sum;
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

  const taxesWithAmounts = (propTaxes || []).map((tax) => ({
    ...tax,
    amount: Number(tax.amount ?? tax.cost ?? 0),
  }));
  const taxesAmountSum = taxesWithAmounts.reduce(
    (sum, tax) => sum + (Number.isFinite(tax.amount) ? tax.amount : 0),
    0,
  );

  if (
    (invoice.totalTax !== undefined && invoice.totalTax !== null) ||
    (invoice.tax_amount !== undefined && invoice.tax_amount !== null)
  ) {
    // Prefer tax stored on the sale
    totalTax = Number(invoice.totalTax ?? invoice.tax_amount ?? 0);
  } else if (taxesAmountSum > 0) {
    totalTax = taxesAmountSum;
  } else if (propTaxes && propTaxes.length > 0) {
    // Calculate tax from taxes array
    if (vatPolicy === "all") {
      // Handle mixed taxes: separate inclusive and exclusive
      const inclusiveTaxes = propTaxes.filter((tax) => !isExclusiveTaxRow(tax));
      const exclusiveTaxes = propTaxes.filter((tax) => isExclusiveTaxRow(tax));

      // For inclusive taxes: Extract VAT from taxable amount AFTER discount (37,000 → 2,581.40)
      if (inclusiveTaxes.length > 0 && taxableNetAmount > 0) {
        const inclusiveTaxRate = inclusiveTaxes.reduce((sum, tax) => {
          return sum + (parseFloat(tax.rate) || 0);
        }, 0);
        if (inclusiveTaxRate > 0) {
          totalTax +=
            (taxableNetAmount * inclusiveTaxRate) / (100 + inclusiveTaxRate);
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

  // Exclusive VAT to fold into Amount(₦) / add to grand total
  const exclusiveTaxTotal = (() => {
    const fromRows = (propTaxes || [])
      .filter((tax) => isExclusiveTaxRow(tax))
      .reduce((sum, tax) => sum + Number(tax.amount ?? tax.cost ?? 0), 0);
    if (fromRows > 0) return fromRows;
    const anyInclusive = (propTaxes || []).some(
      (tax) => !isExclusiveTaxRow(tax),
    );
    if (anyInclusive) return 0;
    if (!propTaxes?.length && totalTax > 0 && !isInclusiveTax) {
      return totalTax;
    }
    return 0;
  })();
  const foldVatIntoUnitPrice =
    Number(exclusiveTaxTotal) > 0 &&
    (!showVatOnSalesInvoice || customerPrintMode === "amount");
  const vatToFold = Number(exclusiveTaxTotal) || 0;
  const displaySubtotal = foldVatIntoUnitPrice
    ? subtotal + vatToFold
    : subtotal;

  // Step 8: Grand total — inclusive VAT is already in line prices.
  let totalAmount = 0;
  const backendTotal = Number(
    invoice.totalAmount ?? invoice.total_amount ?? NaN,
  );
  const inclusiveComputed = netAmountAfterDiscount;
  const exclusiveAddOn =
    exclusiveTaxTotal > 0
      ? exclusiveTaxTotal
      : vatPolicy === "all" && propTaxes?.length
        ? propTaxes
            .filter((tax) => isExclusiveTaxRow(tax))
            .reduce((sum, tax) => {
              if (!(taxableNetAmount > 0)) return sum;
              return (
                sum + (taxableNetAmount * (parseFloat(tax.rate) || 0)) / 100
              );
            }, 0)
        : 0;
  const hasInclusiveVat =
    isInclusiveTax ||
    (propTaxes || []).some((tax) => !isExclusiveTaxRow(tax));
  if (hasInclusiveVat && exclusiveAddOn <= 0.0001) {
    totalAmount = inclusiveComputed;
  } else if (vatPolicy === "all") {
    totalAmount = inclusiveComputed + exclusiveAddOn;
  } else if (Number.isFinite(backendTotal) && backendTotal > 0) {
    totalAmount = backendTotal;
  } else {
    totalAmount = netAmountAfterDiscount + totalTax;
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
    [items, propSetCustomerCopyPrices],
  );

  // Calculate customer copy: Step 1 - Gross selling price
  const customerCopySubtotal = customerCopyPriceList.reduce(
    (sum, price, index) => {
      const quantity = items[index]?.quantity_sold || 0;
      return sum + price * quantity;
    },
    0,
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
      const isTaxable = isProductTaxable(item?.taxable);
      if (!isTaxable) return sum;
      const quantity = item?.quantity_sold || 0;
      return sum + price * quantity;
    },
    0,
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
      const inclusiveTaxes = customerCopyTaxes.filter(
        (tax) =>
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive"),
      );
      const exclusiveTaxes = customerCopyTaxes.filter(
        (tax) =>
          tax.inclusive_type === "exclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "exclusive"),
      );

      // For inclusive taxes: Extract VAT from subtotal (before discount) since subtotal includes VAT
      if (inclusiveTaxes.length > 0 && customerCopyTaxableSubtotal > 0) {
        const inclusiveTaxRate = inclusiveTaxes.reduce((sum, tax) => {
          return sum + (parseFloat(tax.rate) || 0);
        }, 0);
        if (inclusiveTaxRate > 0) {
          // Extract VAT from subtotal: VAT = subtotal × rate / (100 + rate)
          customerCopyTaxAmount +=
            (customerCopyTaxableSubtotal * inclusiveTaxRate) /
            (100 + inclusiveTaxRate);
        }
      }

      // For exclusive taxes: Calculate VAT on taxable net amount (after discount)
      if (exclusiveTaxes.length > 0 && customerCopyTaxableNetAmount > 0) {
        customerCopyTaxAmount += exclusiveTaxes.reduce((sum, tax) => {
          return (
            sum +
            (customerCopyTaxableNetAmount * (parseFloat(tax.rate) || 0)) / 100
          );
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
  if (
    vatPolicy === "all" &&
    customerCopyTaxes &&
    customerCopyTaxes.length > 0
  ) {
    // Handle mixed taxes: separate inclusive and exclusive
    const inclusiveTaxes = customerCopyTaxes.filter(
      (tax) =>
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "inclusive"),
    );
    const exclusiveTaxes = customerCopyTaxes.filter(
      (tax) =>
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive"),
    );

    // Calculate exclusive VAT only (inclusive VAT is already in subtotal)
    let exclusiveVAT = 0;
    if (exclusiveTaxes.length > 0 && customerCopyTaxableNetAmount > 0) {
      exclusiveVAT = exclusiveTaxes.reduce((sum, tax) => {
        return (
          sum +
          (customerCopyTaxableNetAmount * (parseFloat(tax.rate) || 0)) / 100
        );
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
          unit_of_measure: item?.unit_of_measure || item?.uom_category,
          type: item?.type,
          quantity_sold: quantity,
          selling_price: price,
          amount,
          original_price: Number(item?.selling_price || 0),
          original_amount:
            Number(item?.selling_price || 0) * (item?.quantity_sold || 0),
        };
      }),
    [customerCopyPriceList, items],
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
    const n = Number(num);
    if (!Number.isFinite(n)) return "0";
    const isWhole = Math.abs(n - Math.round(n)) < 0.0005;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2,
    });
  };

  const formatPaymentMode = (mode) => {
    const raw = String(mode || "").trim();
    if (!raw) return "—";
    if (raw.includes("+")) {
      return raw
        .split("+")
        .map((w) => w.trim())
        .filter(Boolean)
        .map((w) =>
          w.toLowerCase() === "deposit" || w.toLowerCase() === "apply deposit"
            ? "Apply Deposit"
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join(" + ");
    }
    const lower = raw.toLowerCase();
    if (
      lower === "credit_split" ||
      lower === "credit+cash+transfer" ||
      lower === "credit + cash + transfer"
    ) {
      return "Credit + Cash + Transfer";
    }
    if (lower === "split" || lower === "cash+transfer" || lower === "cash + transfer") {
      return "Cash + Transfer";
    }
    if (lower === "deposit" || lower === "apply_deposit") return "Apply Deposit";
    if (lower === "card") return "Card";
    return raw
      .replace(/_/g, " ")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  };

  const invoiceDateValue =
    invoice.transaction?.date || invoice.date || propDate;

  const invoiceReference =
    invoice.transaction?.id ||
    invoice.transaction?.reference ||
    saleCode ||
    "N/A";

  const warehouseLabel =
    invoice?.warehouse_name ||
    invoice?.warehouse ||
    invoice?.branch_name ||
    (Array.isArray(invoice?.warehouses) && invoice.warehouses.length
      ? invoice.warehouses.join(", ")
      : null) ||
    [
      ...new Set(
        items
          .map((it) => it.warehouse_name || it.warehouse || it.branch_name)
          .filter(Boolean),
      ),
    ].join(", ") ||
    "—";

  const modeOfPayment =
    invoice?.mode_of_payment ||
    invoice?.transaction?.mode_of_payment ||
    invoice?.transaction?.payment_type ||
    items.find((it) => it.mode_of_payment)?.mode_of_payment ||
    "CREDIT";

  const paymentModes = (() => {
    const raw =
      invoice?.payment_modes || invoice?.transaction?.payment_modes || [];
    if (Array.isArray(raw) && raw.length) {
      return raw.map((m) => String(m || "").toLowerCase().trim()).filter(Boolean);
    }
    return [];
  })();

  const amountPaid = Number(
    invoice?.amount_paid ??
      invoice?.transaction?.amount_paid ??
      invoice?.paid_amount ??
      0,
  );

  const paymentBreakdown = Array.isArray(invoice?.payment_breakdown)
    ? invoice.payment_breakdown
    : Array.isArray(invoice?.transaction?.payment_breakdown)
      ? invoice.transaction.payment_breakdown
      : [];

  const cashPaid = Number(
    invoice?.cash_paid ??
      invoice?.transaction?.cash_paid ??
      paymentBreakdown
        .filter((p) => String(p.mode || "").toLowerCase() === "cash")
        .reduce((s, p) => s + Number(p.amount || 0), 0),
  );

  const transferLines = paymentBreakdown.filter((p) => {
    const m = String(p.mode || "").toLowerCase();
    return m === "transfer" || m === "bank";
  });

  const transferPaid = Number(
    invoice?.transfer_paid ??
      invoice?.transaction?.transfer_paid ??
      transferLines.reduce((s, p) => s + Number(p.amount || 0), 0),
  );

  const cardLines = paymentBreakdown.filter(
    (p) => String(p.mode || "").toLowerCase() === "card",
  );

  const cardPaid = Number(
    invoice?.card_paid ??
      invoice?.transaction?.card_paid ??
      cardLines.reduce((s, p) => s + Number(p.amount || 0), 0),
  );

  const transferBanks = (() => {
    const fromApi =
      invoice?.transfer_banks || invoice?.transaction?.transfer_banks || [];
    if (Array.isArray(fromApi) && fromApi.length)
      return fromApi.filter(Boolean);
    return [...new Set(transferLines.map((p) => p.bank_name).filter(Boolean))];
  })();

  const depositPaid = Number(
    invoice?.deposit_paid ??
      invoice?.transaction?.deposit_paid ??
      paymentBreakdown
        .filter((p) => {
          const m = String(p.mode || "").toLowerCase();
          return m === "deposit" || m === "advance";
        })
        .reduce((s, p) => s + Number(p.amount || 0), 0),
  );

  const invoiceTotalForBalance = Number(
    invoice?.invoice_total_amount ??
      invoice?.transaction?.invoice_total_amount ??
      invoice?.totalAmount ??
      invoice?.total_amount ??
      totalAmount ??
      0,
  );

  const creditPaid = Number(
    invoice?.credit_paid ??
      invoice?.transaction?.credit_paid ??
      paymentBreakdown
        .filter((p) => String(p.mode || "").toLowerCase() === "credit")
        .reduce((s, p) => s + Number(p.amount || 0), 0) ??
      0,
  );

  const hasCashMode = paymentModes.includes("cash");
  const hasTransferMode =
    paymentModes.includes("transfer") || paymentModes.includes("bank");
  const hasCardMode = paymentModes.includes("card");
  const hasCreditMode = paymentModes.includes("credit");
  const hasDepositMode = paymentModes.includes("deposit");
  const mixedPaymentModes =
    [
      hasCashMode,
      hasTransferMode,
      hasCardMode,
      hasCreditMode,
      hasDepositMode,
    ].filter(Boolean).length > 1;

  const isCreditOnlyMode =
    !mixedPaymentModes &&
    (hasCreditMode ||
      (!paymentModes.length &&
        String(modeOfPayment || "").toLowerCase() === "credit"));

  const creditAmount =
    creditPaid > 0.05
      ? creditPaid
      : isCreditOnlyMode
        ? Math.max(
            0,
            Number(
              (
                invoiceTotalForBalance -
                cashPaid -
                transferPaid -
                cardPaid -
                depositPaid
              ).toFixed(2),
            ),
          )
        : 0;

  const balanceDue = Math.max(
    0,
    Number(
      (
        invoiceTotalForBalance -
        cashPaid -
        transferPaid -
        cardPaid -
        depositPaid -
        creditAmount
      ).toFixed(2),
    ),
  );

  const paymentModeLabel = (() => {
    const order = [
      ["cash", "Cash"],
      ["transfer", "Transfer"],
      ["card", "Card"],
      ["credit", "Credit"],
      ["deposit", "Apply Deposit"],
    ];
    const fromModes = order
      .filter(([id]) =>
        id === "transfer" ? hasTransferMode : paymentModes.includes(id),
      )
      .map(([, label]) => label);
    if (fromModes.length) return fromModes.join(" + ");
    if (cardPaid > 0.05 && cashPaid <= 0.05 && transferPaid <= 0.05)
      return hasCreditMode ? "Card + Credit" : "Card";
    if (cashPaid > 0.05 && transferPaid > 0.05 && creditAmount > 0.05) {
      return "Cash + Transfer + Credit";
    }
    if (cashPaid > 0.05 && transferPaid > 0.05) return "Cash + Transfer";
    if (cashPaid > 0.05 && creditAmount > 0.05 && transferPaid <= 0.05) {
      return "Cash + Credit";
    }
    if (transferPaid > 0.05 && creditAmount > 0.05 && cashPaid <= 0.05) {
      return "Transfer + Credit";
    }
    if (depositPaid > 0.05 && cashPaid <= 0.05 && transferPaid <= 0.05)
      return hasCreditMode ? "Apply Deposit + Credit" : "Apply Deposit";
    if (cashPaid > 0 && transferPaid <= 0 && creditAmount <= 0.05) return "Cash";
    if (transferPaid > 0 && cashPaid <= 0 && creditAmount <= 0.05)
      return "Transfer";
    if (creditAmount > 0.05 && cashPaid <= 0.05 && transferPaid <= 0.05)
      return "Credit";
    return formatPaymentMode(modeOfPayment);
  })();
  const handleReactToPrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: `Invoice-${invoiceReference}`,
    pageStyle: `
      @page {
        size: ${pageSizeLabel} portrait;
        margin: ${isA5 ? "6mm" : "0"} !important;
      }
      html, body {
        width: ${pageWidthMm}mm;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        print-color-adjust: ${printInColor ? "exact" : "economy"};
        -webkit-print-color-adjust: ${printInColor ? "exact" : "economy"};
        font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
      }
      ${printInColor ? "" : invoiceBwCss}
      .invoice-items-table {
        font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
      }
      .invoice-items-table th {
        font-size: ${isA5 ? "11px" : "13px"} !important;
      }
      .invoice-items-table td {
        font-size: ${isA5 ? "12px" : "13px"} !important;
      }
      .invoice-items-table td:nth-child(2) {
        font-size: ${isA5 ? "12.5px" : "14px"} !important;
        font-weight: 600 !important;
      }
      .invoice-container {
        width: ${pageWidthMm}mm !important;
        max-width: ${pageWidthMm}mm !important;
        margin: 0 auto !important;
        padding: 4px !important;
        box-shadow: none !important;
        border: 2px solid #1a2d5e !important;
        background: #fff !important;
        overflow: visible !important;
        ${isA5 ? "" : `height: ${pageHeightMm}mm !important; min-height: ${pageHeightMm}mm !important; max-height: ${pageHeightMm}mm !important; overflow: hidden !important;`}
      }
      .invoice-page {
        display: flex !important;
        flex-direction: column !important;
        ${isA5 ? "" : `height: ${pageHeightMm}mm !important; min-height: ${pageHeightMm}mm !important;`}
      }
      .invoice-page-half {
        display: flex !important;
        flex-direction: column !important;
        min-height: 0 !important;
        ${
          isA5
            ? `width: 100% !important; page-break-after: always !important; break-after: page !important;`
            : `flex: 1 1 50% !important; overflow: hidden !important;`
        }
      }
      .invoice-page-half:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .invoice-page-half-fill {
        ${isA5 ? "display: none !important;" : "flex: 1 1 auto !important; min-height: 0.5rem !important;"}
      }
      .invoice-page-divider {
        flex-shrink: 0 !important;
        ${isA5 ? "display: none !important;" : ""}
      }
      .a5-tight { font-size: 10px !important; }
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
          (err) => reject(err),
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
          },
        );
      }
      if (enableInlineCustomerCopyPreview) {
        setCustomerCopyEnabled(true);
      }
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
    <div className="bg-gray-50 p-4">
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
    <div className="bg-gray-50 pb-2 print:bg-white print:pb-0">
      <style>{`
        ${printInColor ? "" : invoiceBwCss}
        @media print {
          .no-print { display: none !important; }
          .invoice-container {
            width: ${pageWidthMm}mm !important;
            max-width: ${pageWidthMm}mm !important;
            padding: 4px !important;
            box-shadow: none !important;
            border: 2px solid #1a2d5e !important;
            ${
              isA5
                ? "overflow: visible !important; height: auto !important; max-height: none !important;"
                : `height: ${pageHeightMm}mm !important; min-height: ${pageHeightMm}mm !important; max-height: ${pageHeightMm}mm !important; overflow: hidden !important;`
            }
          }
          .invoice-page {
            display: flex !important;
            flex-direction: column !important;
            ${isA5 ? "" : `height: ${pageHeightMm}mm !important; min-height: ${pageHeightMm}mm !important;`}
          }
          .invoice-page-half {
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            ${
              isA5
                ? "page-break-after: always !important; break-after: page !important;"
                : "flex: 1 1 50% !important; overflow: hidden !important;"
            }
          }
          .invoice-page-half:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .invoice-page-half-fill {
            ${isA5 ? "display: none !important;" : "flex: 1 1 auto !important;"}
          }
          .invoice-page-divider {
            ${isA5 ? "display: none !important;" : ""}
          }
          @page {
            margin: ${isA5 ? "6mm" : "0"};
            size: ${pageSizeLabel} portrait;
          }
          body {
            print-color-adjust: ${printInColor ? "exact" : "economy"};
            -webkit-print-color-adjust: ${printInColor ? "exact" : "economy"};
          }
          ${printInColor ? "" : invoiceBwCss}
          .border-dashed {
            border-style: dashed !important;
          }
        }
        ${
          isA5
            ? `
        .invoice-a5 .invoice-page-half-fill { display: none; }
        .invoice-a5 .invoice-page-divider { display: none; }
        .invoice-a5 .invoice-items-table th { padding: 4px 6px !important; font-size: 11px !important; }
        .invoice-a5 .invoice-items-table td { padding: 4px 6px !important; font-size: 12px !important; }
        .invoice-a5 .invoice-items-table td:nth-child(2) { font-size: 12.5px !important; }
        .invoice-a5 .a5-section { padding: 0 2px; }
        .invoice-items-table {
          font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        }
        .invoice-items-table th {
          letter-spacing: 0.02em;
        }
        .invoice-items-table td:nth-child(2) {
          font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
          line-height: 1.35;
        }
        @media print {
          .invoice-items-table {
            font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", Arial, sans-serif !important;
          }
          .invoice-items-table th {
            font-size: 13px !important;
          }
          .invoice-items-table td {
            font-size: 13px !important;
          }
          .invoice-items-table td:nth-child(2) {
            font-size: 14px !important;
            font-weight: 600 !important;
          }
        }
        `
            : ""
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
          <div className="flex flex-wrap gap-2 ml-auto items-center">
            {showPrintButton &&
            showInvoiceSection &&
            showVatOnSalesInvoice &&
            (Number(exclusiveTaxTotal) > 0 ||
              Number(totalTax) > 0 ||
              (resolvedTaxes && resolvedTaxes.length > 0)) ? (
              <div
                className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white"
                role="tablist"
                aria-label="Customer copy type"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={customerPrintMode === "amount"}
                  onClick={() => setCustomerPrintMode("amount")}
                  className={`px-3 py-0.5 text-sm transition-colors ${
                    customerPrintMode === "amount"
                      ? "bg-[var(--aa-navy)] text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Amount only
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={customerPrintMode === "vat"}
                  onClick={() => setCustomerPrintMode("vat")}
                  className={`px-3 py-0.5 text-sm border-l border-slate-300 transition-colors ${
                    customerPrintMode === "vat"
                      ? "bg-[var(--aa-navy)] text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  With VAT
                </button>
              </div>
            ) : null}
            {showPrintButton ? (
              <div
                className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white"
                role="tablist"
                aria-label="Print color"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!printInColor}
                  onClick={() => setPrintInColor(false)}
                  className={`px-3 py-0.5 text-sm transition-colors ${
                    !printInColor
                      ? "bg-[var(--aa-navy)] text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Black and white
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={printInColor}
                  onClick={() => setPrintInColor(true)}
                  className={`px-3 py-0.5 text-sm border-l border-slate-300 transition-colors ${
                    printInColor
                      ? "bg-[var(--aa-navy)] text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Color
                </button>
              </div>
            ) : null}
            {showPrintButton && (
              <button
                onClick={handlePrint}
                className="px-3 py-0.5 text-sm bg-[var(--aa-navy)] text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors"
              >
                <Printer size={14} /> Print
                {showInvoiceSection &&
                showVatOnSalesInvoice &&
                (Number(exclusiveTaxTotal) > 0 ||
                  Number(totalTax) > 0 ||
                  (resolvedTaxes && resolvedTaxes.length > 0))
                  ? customerPrintMode === "amount"
                    ? " (Amount)"
                    : " (VAT)"
                  : showDeliveryOrder
                    ? ` ${dispatchDocTitle}`
                    : ""}
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
        className={`${
          isA5 ? "max-w-[148mm] invoice-a5" : "max-w-5xl"
        } mx-auto bg-white shadow-sm invoice-container border-2 border-[var(--aa-navy,#1a2d5e)] p-1.5${
          printInColor ? "" : " invoice-bw"
        }`}
        style={isA5 ? { width: "148mm" } : undefined}
      >
        <div
          className={`invoice-page flex flex-col ${
            isA5 ? "min-h-0" : "min-h-0 print:min-h-[297mm] print:h-[297mm]"
          }`}
        >
          {showInvoiceSection ? (
            <section
              className={`invoice-page-half flex flex-col min-h-0 ${
                isA5 ? "mb-2 print:mb-0 a5-section" : "flex-1"
              }`}
            >
              <BusinessDocumentHeader
                business={business}
                title="Sales Invoice"
                numberLabel={`No: ${invoiceReference}`}
                warehouse={
                  copyLabel ||
                  (warehouseLabel && warehouseLabel !== "—"
                    ? warehouseLabel
                    : "")
                }
                date={invoiceDateValue}
                compact={isA5}
              />

              {/* Invoice Details Grid */}
              <div className={`grid gap-1 ${isA5 ? "mb-0.5" : "mb-1"}`}>
                <div
                  className={`bg-blue-50 border border-blue-200 ${isA5 ? "p-0.5 px-1" : "p-1"}`}
                >
                  <h6
                    className={`font-semibold text-blue-800 uppercase tracking-wide ${isA5 ? "text-[10px] mb-0" : "text-xs mb-"}`}
                  >
                    Bill To
                  </h6>
                  <p
                    className={`${isA5 ? "text-[10px] leading-snug" : "text-xs leading-relaxed"} text-gray-700`}
                  >
                    <span className="font-semibold text-gray-600">
                      Account Name:
                    </span>{" "}
                    <span className="text-gray-900">
                      {customer.customer_name}
                    </span>{" "}
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
                        <span className="text-gray-900">
                          {customer.address}
                        </span>
                      </>
                    )}
                    <span className="text-gray-400 mx-1">|</span>
                    <span className="font-semibold text-gray-600">
                      Warehouse:
                    </span>{" "}
                    <span className="text-gray-900">{warehouseLabel}</span>
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className={isA5 ? "mb-0.5" : "mb-1"}>
                <table className="invoice-items-table w-full border-collapse border border-gray-300 overflow-hidden shadow-sm">
                  <thead>
                    <tr className="bg-[var(--aa-doc-header,var(--aa-navy,#1a2d5e))] text-white">
                      <th
                        className={`border-r border-[var(--aa-accent)] text-center font-semibold tracking-wide ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                      >
                        #
                      </th>
                      <th
                        className={`border-r border-[var(--aa-accent)] text-left font-semibold tracking-wide ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                      >
                        Description/Size
                      </th>
                      <th
                        className={`border-r border-[var(--aa-accent)] text-center font-semibold tracking-wide ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                      >
                        Quantity
                      </th>
                      <th
                        className={`border-r border-[var(--aa-accent)] text-right font-semibold tracking-wide ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                      >
                        Unit Price(₦)
                      </th>
                      <th
                        className={`text-right font-semibold tracking-wide ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                      >
                        Amount(₦)
                      </th>
                    </tr>
                  </thead>

                  <tbody className="bg-white">
                    {items.map((item, index) => {
                      const resolvedCustomPrice = customerCopyPriceList[index];
                      const baseUnitPrice = Number(
                        customerCopyEnabled
                          ? resolvedCustomPrice
                          : item.selling_price || 0,
                      );
                      const qty = Number(item.quantity_sold || 0);
                      const lineExVat = baseUnitPrice * qty;
                      // Amount-only tab: fold exclusive VAT into Unit Price
                      let lineVat = 0;
                      if (foldVatIntoUnitPrice && isItemTaxable(item)) {
                        lineVat =
                          taxableNetAmount > 0
                            ? (lineExVat / taxableNetAmount) * vatToFold
                            : vatToFold /
                              (items.filter((it) => isItemTaxable(it)).length ||
                                1);
                      } else if (
                        foldVatIntoUnitPrice &&
                        !items.some((it) => isItemTaxable(it))
                      ) {
                        // No taxable flags — spread VAT across all lines
                        lineVat =
                          items.length > 0
                            ? vatToFold / items.length
                            : vatToFold;
                      }
                      const unitVat = qty > 0 ? lineVat / qty : lineVat;
                      const displayUnitPrice = baseUnitPrice + unitVat;
                      const displayAmount = displayUnitPrice * qty;
                      const itemUom = String(
                        item.unit_of_measure ||
                          item.uom_category ||
                          item.uom ||
                          item.unit_measure ||
                          "",
                      ).trim();
                      const itemName =
                        item.item_name || item.description || "N/A";

                      return (
                        <tr
                          key={item.id}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td
                            className={`border-r border-t border-gray-200 text-center font-semibold text-gray-600 ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                          >
                            {index + 1}
                          </td>
                          <td
                            className={`border-r border-t border-gray-200 ${isA5 ? "px-1.5 py-1 text-[12px]" : "px-2.5 py-2 text-[15px]"}`}
                          >
                            <span className="font-semibold leading-snug text-gray-900">
                              {itemName}
                              {itemUom ? ` (${itemUom})` : ""}
                            </span>
                          </td>
                          <td
                            className={`border-r border-t border-gray-200 text-center tabular-nums text-gray-800 ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                          >
                            {formatNumber(item.quantity_sold)}
                          </td>
                          <td
                            className={`border-r border-t border-gray-200 text-right tabular-nums text-gray-800 ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                          >
                            {formatNumber(displayUnitPrice)}
                          </td>
                          <td
                            className={`border-t border-gray-200 text-right tabular-nums font-semibold text-gray-900 ${isA5 ? "px-1.5 py-1 text-[11px]" : "px-2.5 py-2 text-sm"}`}
                          >
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
                          {formatNumber(
                            items.reduce(
                              (sum, item) => sum + (item.quantity_sold || 0),
                              0,
                            ),
                          )}
                        </h6>
                      </td>
                      <td className="border-r border-t border-gray-300 px-2 py-1.5 text-right text-xs font-semibold text-gray-900">
                        <div className="font-semibold text-gray-700">
                          SUBTOTAL:
                        </div>
                      </td>
                      <td className="border-t border-gray-300 px-2 py-1.5 text-right text-xs">
                        <div className="font-bold text-gray-900">
                          {formatNumber(
                            customerCopyEnabled
                              ? customerCopySubtotal
                              : displaySubtotal,
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
                              : discountAmount,
                          )}
                        </td>
                      </tr>
                    )}
                    {resolvedTaxes.map((tax, index) => {
                        if (
                          !showVatOnSalesInvoice ||
                          customerPrintMode === "amount"
                        ) {
                          return null;
                        }
                        const isTaxInclusive = !isExclusiveTaxRow(tax);
                        if (foldVatIntoUnitPrice && !isTaxInclusive) {
                          return null;
                        }

                        // Prefer VAT amount stored on the sale; fall back to rate calc
                        let taxAmount = Number(tax.amount ?? tax.cost ?? 0);
                        if (!(taxAmount > 0)) {
                          if (customerCopyEnabled) {
                            // Customer copy tax calculation
                            if (isTaxInclusive) {
                              // For inclusive: Extract VAT from subtotal (before discount) since subtotal includes VAT
                              // Formula: VAT = subtotal × rate / (100 + rate)
                              const totalTaxRate = customerCopyTaxes
                                .filter((t) => {
                                  const tIsInclusive =
                                    vatPolicy === "all"
                                      ? t.inclusive_type === "inclusive" ||
                                        (t.inclusive_type === undefined &&
                                          t.tax_type === "inclusive")
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
                                (customerCopyTaxableNetAmount *
                                  parseFloat(tax.rate)) /
                                100;
                            }
                          } else {
                            // Main invoice tax calculation
                            if (isTaxInclusive) {
                              // For inclusive: Extract VAT from taxable amount AFTER discount (37,000 → 2,581.40)
                              const totalTaxRate = propTaxes
                                .filter((t) => {
                                  const tIsInclusive =
                                    vatPolicy === "all"
                                      ? t.inclusive_type === "inclusive" ||
                                        (t.inclusive_type === undefined &&
                                          t.tax_type === "inclusive")
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
                        }
                        if (
                          !(taxAmount > 0) &&
                          exclusiveTaxTotal > 0 &&
                          resolvedTaxes.length === 1
                        ) {
                          taxAmount = exclusiveTaxTotal;
                        }

                        return (
                          <tr key={index} className="bg-gray-50">
                            <td
                              colSpan="4"
                              className="border-r border-t border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-700"
                            >
                              {tax.description} ({tax.rate}%{" "}
                              {isTaxInclusive ? "Inclusive" : "Exclusive"}
                              ):
                            </td>
                            <td className="border-t border-gray-200 px-2 py-1 text-right text-xs font-semibold text-gray-900">
                              {formatNumber(
                                taxAmount ||
                                  (customerCopyEnabled
                                    ? customerCopyTaxAmount
                                    : totalTax),
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
                        className={`border-r border-green-500 text-right font-bold ${isA5 ? "px-1 py-1 text-xs" : "px-2 py-2 text-sm"}`}
                      >
                        GRAND TOTAL:
                      </td>
                      <td
                        className={`text-right font-bold ${isA5 ? "px-1 py-1 text-xs" : "px-2 py-2 text-sm"}`}
                      >
                        ₦
                        {formatNumber(
                          customerCopyEnabled
                            ? customerCopyTotalAmount
                            : totalAmount,
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* How this invoice is paid — same presentation as Bill To */}
              {(() => {
                const collectedNow = Number(
                  (cashPaid + transferPaid + cardPaid).toFixed(2),
                );
                const onCredit = Number(creditAmount.toFixed(2));
                const depositApplied = Number(depositPaid.toFixed(2));
                const outstanding = Number(balanceDue.toFixed(2));
                const isCreditOnly =
                  isCreditOnlyMode &&
                  onCredit > 0.05 &&
                  collectedNow <= 0.05 &&
                  depositApplied <= 0.05;
                const creditShown = isCreditOnly ? outstanding || onCredit : onCredit;
                const fields = [
                  { label: "Mode", value: paymentModeLabel },
                  {
                    label: "Paid at sale",
                    value: `₦${formatNumber(collectedNow)}`,
                  },
                ];
                if (depositApplied > 0.05) {
                  fields.push({
                    label: "Deposit applied",
                    value: `₦${formatNumber(depositApplied)}`,
                  });
                }
                if (isCreditOnly || onCredit > 0.05) {
                  fields.push({
                    label: "On credit",
                    value: `₦${formatNumber(creditShown)}`,
                  });
                } else if (outstanding > 0.05) {
                  fields.push({
                    label: "Still outstanding",
                    value: `₦${formatNumber(outstanding)}`,
                  });
                }
                if (cashPaid > 0.05) {
                  fields.push({
                    label: "Cash received",
                    value: `₦${formatNumber(cashPaid)}`,
                  });
                }
                if (transferLines.length > 0) {
                  transferLines.forEach((line) => {
                    fields.push({
                      label: "Transfer received",
                      value: `₦${formatNumber(line.amount)}${
                        line.bank_name ? ` · ${line.bank_name}` : ""
                      }`,
                    });
                  });
                } else if (transferPaid > 0.05) {
                  fields.push({
                    label: "Transfer received",
                    value: `₦${formatNumber(transferPaid)}${
                      transferBanks.length > 0
                        ? ` · ${transferBanks.join(", ")}`
                        : ""
                    }`,
                  });
                }
                if (cardLines.length > 0) {
                  cardLines.forEach((line) => {
                    fields.push({
                      label: "Card received",
                      value: `₦${formatNumber(line.amount)}${
                        line.bank_name ? ` · ${line.bank_name}` : ""
                      }`,
                    });
                  });
                } else if (cardPaid > 0.05) {
                  fields.push({
                    label: "Card received",
                    value: `₦${formatNumber(cardPaid)}`,
                  });
                }

                return (
                  <div className={`grid gap-1 ${isA5 ? "mb-0.5" : "mb-1"}`}>
                    <div
                      className={`bg-blue-50 border border-blue-200 ${isA5 ? "p-0.5 px-1" : "p-1"}`}
                    >
                      <h6
                        className={`font-semibold text-blue-800 uppercase tracking-wide ${isA5 ? "text-[10px] mb-0" : "text-xs mb-"}`}
                      >
                        How this invoice is paid
                      </h6>
                      <p
                        className={`${isA5 ? "text-[10px] leading-snug" : "text-xs leading-relaxed"} text-gray-700`}
                      >
                        {fields.map((field, idx) => (
                          <span key={`${field.label}-${idx}`}>
                            {idx > 0 ? (
                              <span className="text-gray-400 mx-1">|</span>
                            ) : null}
                            <span className="font-semibold text-gray-600">
                              {field.label}:
                            </span>{" "}
                            <span className="text-gray-900">{field.value}</span>
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div
                className={`invoice-page-half-fill min-h-0 ${isA5 ? "hidden" : "hidden print:block print:flex-1 print:min-h-[1rem]"}`}
                aria-hidden="true"
              />

              {/* Invoice + Prepared details */}
              <div
                className={`grid grid-cols-2 gap-2 shrink-0 ${
                  isA5 ? "mb-0.5 mt-1" : "mb-1"
                }`}
              >
                <div
                  className={`bg-gray-50 border border-gray-200 ${
                    isA5 ? "p-1" : "p-2"
                  }`}
                >
                  <h3
                    className={`font-bold text-gray-800 border-b border-gray-300 pb-1 ${
                      isA5 ? "text-[10px] mb-1" : "text-xs mb-2"
                    }`}
                  >
                    Invoice Details
                  </h3>
                  <p
                    className={`${isA5 ? "text-[10px]" : "text-xs"} mb-1 text-gray-700`}
                  >
                    <span className="font-semibold">Invoice No.:</span>{" "}
                    <span className="text-gray-900">{invoiceReference}</span>
                  </p>
                  {invoiceReference ? (
                    <div
                      className={`${isA5 ? "mb-1" : "mb-2"} flex justify-center overflow-hidden`}
                    >
                      <Barcode
                        value={String(invoiceReference)}
                        width={isA5 ? 0.9 : 1.1}
                        height={isA5 ? 24 : 32}
                        displayValue={false}
                        margin={0}
                        background="#f9fafb"
                        lineColor="#000000"
                      />
                    </div>
                  ) : null}
                  <p
                    className={`${isA5 ? "text-[10px]" : "text-xs"} mb-1 text-gray-700`}
                  >
                    <span className="font-semibold">
                      {isGoodsIssueNote
                        ? "Goods Issue Note No:"
                        : "Delivery Order No:"}
                    </span>{" "}
                    <span className="text-gray-900">
                      {dispatchDocPrefix}-{invoiceReference}
                    </span>
                  </p>
                  <p
                    className={`${isA5 ? "text-[10px]" : "text-xs"} mb-1 text-gray-700`}
                  >
                    <span className="font-semibold">Customer:</span>{" "}
                    <span className="text-gray-900">
                      {customer?.customer_name || "—"}
                    </span>
                  </p>
                </div>

                <div
                  className={`bg-blue-50 border border-blue-200 ${
                    isA5 ? "p-1" : "p-1.5"
                  }`}
                >
                  <h6
                    className={`font-bold text-gray-800 border-b border-blue-300 pb-1 ${
                      isA5 ? "text-[10px] mb-1" : "text-xs mb-2"
                    }`}
                  >
                    Prepared Details
                  </h6>
                  <p
                    className={`${isA5 ? "text-[10px]" : "text-xs"} mb-1.5 text-gray-700`}
                  >
                    <span className="font-semibold">Prepared By:</span>{" "}
                    {preparedByName}
                    {preparedById ? ` (${preparedById})` : ""}
                  </p>
                  {preparedBySignature ? (
                    <div className="flex flex-col items-center gap-1 my-1">
                      <img
                        src={preparedBySignature}
                        alt="Prepared by signature"
                        className={`${isA5 ? "h-8" : "h-10"} object-contain`}
                      />
                      <span className="text-[0.65rem] text-gray-500 uppercase tracking-wide">
                        Signature
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 my-1">
                      <div
                        className={`${isA5 ? "h-8" : "h-10"} w-full border-b border-blue-300`}
                      />
                      <span className="text-[0.65rem] text-gray-500 uppercase tracking-wide">
                        Signature
                      </span>
                    </div>
                  )}
                  <p className="mt-1 text-xs font-bold text-center text-blue-800 py-1 bg-blue-100 rounded">
                    FOR {business?.business_name || "COMPANY"}
                  </p>
                </div>
              </div>

              {/* Closing note — compact, proportional to invoice body */}
              {showImportantNote ? (
                <div
                  className={`shrink-0 border-t border-dashed border-slate-300 ${isA5 ? "mt-1 px-1 py-1" : "mt-2 px-1.5 py-1.5"}`}
                >
                  <p
                    className={`${isA5 ? "text-[9px] leading-snug" : "text-[11px] leading-snug"} text-center text-slate-600`}
                  >
                    <span className="font-semibold text-slate-700">
                      Important note:{" "}
                    </span>
                    {importantNoteText}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Dashed Separator — A4 cut sheet only */}
          {showDeliveryOrder && showInvoiceSection ? (
            <div
              className={`invoice-page-divider relative shrink-0 py-1 ${isA5 ? "hidden" : "print:block"}`}
            >
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-gray-400"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-0 text-xs font-semibold text-gray-500 uppercase tracking-wide"></span>
              </div>
            </div>
          ) : null}

          {/* Delivery Order Section */}
          {showDeliveryOrder ? (
            <section
              className={`invoice-page-half flex flex-col min-h-0 bg-gradient-to-b from-gray-50 to-white ${
                isA5 ? "a5-section" : "flex-1"
              }`}
            >
              <BusinessDocumentHeader
                business={business}
                title={dispatchDocTitle}
                numberLabel={`No: ${dispatchDocPrefix}-${invoiceReference}`}
                warehouse={
                  copyLabel ||
                  (warehouseLabel && warehouseLabel !== "—"
                    ? warehouseLabel
                    : "")
                }
                date={invoiceDateValue}
                compact={isA5}
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
                    <span className="text-gray-900">
                      {customer.customer_name}
                    </span>{" "}
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
                        <span className="text-gray-900">
                          {customer.address}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="border border-slate-200 bg-slate-50 p-1 pl-3">
                  <p className="text-xs text-gray-700 leading-relaxed">
                    <span className="font-semibold text-gray-600">
                      Warehouse:
                    </span>{" "}
                    <span className="text-gray-900">{warehouseLabel}</span>
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
                          {(item.warehouse_name || item.warehouse) && (
                            <span className="ml-2 text-xs text-slate-500">
                              · {item.warehouse_name || item.warehouse}
                            </span>
                          )}
                        </td>
                        <td className="border-t border-gray-200 px-2 py-1.5 text-center text-xs text-gray-700">
                          {formatNumber(getItemQuantity(item))}
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
                        {formatNumber(totalCylinders)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                className={`invoice-page-half-fill min-h-0 ${isA5 ? "hidden" : "hidden print:block print:flex-1 print:min-h-[1rem]"}`}
                aria-hidden="true"
              />

              <div
                className={`grid grid-cols-2 gap-2 shrink-0 ${isA5 ? "mb-0.5 mt-1" : "mb-1"}`}
              >
                {!isGoodsIssueNote ? (
                  <div
                    className={`bg-gray-50 border border-gray-200 ${isA5 ? "p-1" : "p-1.5"}`}
                  >
                    <h3
                      className={`font-bold text-gray-800 border-b border-gray-300 pb-1 ${isA5 ? "text-[10px] mb-1" : "text-xs mb-2"}`}
                    >
                      Delivery Information
                    </h3>
                    <p className="flex items-end gap-1 text-xs mb-1 text-gray-700">
                      <span className="font-semibold shrink-0">
                        Vehicle No:
                      </span>
                      <span className="flex-1 border-b border-gray-700 min-h-[1rem]" />
                    </p>
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 ">
                      <h6 className="font-semibold text-xs text-blue-900 mb-1">
                        DELIVERED BY STORES OFFICER:
                      </h6>
                      <h6 className="italic text-xs text-blue-700">
                        Received the above items in good condition
                      </h6>
                      <div className="mt-2 border-t border-blue-300 pt-2">
                        <p className="flex items-end gap-1 text-xs text-gray-600">
                          <span className="shrink-0">Signature:</span>
                          <span className="flex-1 border-b border-gray-500 min-h-[1rem]" />
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div
                  className={`bg-green-50 border border-green-200 p-1 overflow-hidden ${
                    isGoodsIssueNote ? "col-span-2" : ""
                  }`}
                >
                  <h3 className="text-xs font-bold text-gray-800 mb-2 border-b border-green-300 pb-1">
                    {isGoodsIssueNote
                      ? "Approval Details"
                      : "Driver & Authorization"}
                  </h3>
                  {!isGoodsIssueNote ? (
                    <p className="flex items-end gap-1 text-xs mb-1 text-gray-700 min-w-0">
                      <span className="font-semibold shrink-0">
                        Driver&apos;s Name:
                      </span>
                      <span className="flex-1 border-b border-gray-700 min-h-[1rem] min-w-0" />
                    </p>
                  ) : (
                    <p className="text-xs mb-2 text-gray-700">
                      <span className="font-semibold">Prepared:</span>{" "}
                      <span className="text-gray-900">{preparedByName}</span>
                    </p>
                  )}
                  <div className="mt-3 p-2 bg-white border border-gray-300 ">
                    <p className="font-semibold text-xs text-gray-900 mb-2">
                      {isGoodsIssueNote ? "SIGNATURE:" : "RECEIVED BY:"}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-gray-600 mb-1">
                          {isGoodsIssueNote ? "Sign:" : "Name:"}
                        </p>
                        <div className="border-b border-gray-400 h-5"></div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-1">
                          {isGoodsIssueNote ? "Date:" : "Signature:"}
                        </p>
                        <div className="border-b border-gray-400 h-5"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thank-you note on Goods Issue Note only */}
              {isGoodsIssueNote && showImportantNote ? (
                <div className="shrink-0 mt-auto px-1 py-1.5 border-t border-dashed border-gray-300">
                  <p className="text-center italic text-xs text-gray-700 leading-snug">
                    {importantNoteText}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
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
  paperSize: PropTypes.oneOf(["a4", "a5"]),
  documentMode: PropTypes.oneOf(["invoice", "dispatch", "both"]),
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
  onApplyCustomerCopy: PropTypes.func,
  onCustomerCopySaved: PropTypes.func,
};
