/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  FileText,
  X,
  Loader,
  Users,
  ExternalLink,
  Calendar,
  Building2,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import moment from "moment";
// import DepartmentSelect from "@/components/common/DepartmentSelect";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { getSuppliers } from "@/redux/actions/suppliers";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import useQuery from "@/hooks/useQuery";
import CashTransferPaymentFields, {
  buildPaymentSplits,
  isCashTransferSplitMode,
  parseMoneyInput,
} from "@/components/common/CashTransferPaymentFields";
import CreatableSelect from "react-select/creatable";
import {
  isProductTaxable,
  normalizeTaxableStatus,
  taxableStatusStyle,
  TAXABLE_STATUS_OPTIONS,
} from "@/utils/taxableStatus";

function applyLineTaxable(item, nextStatus, defaultLineTaxId) {
  const taxable = normalizeTaxableStatus(nextStatus, "Taxable");
  return {
    ...item,
    taxable,
    line_tax_id: isProductTaxable(taxable)
      ? item.line_tax_id || defaultLineTaxId || null
      : null,
  };
}

const initialItemForm = {
  item_name: "",
  sku: "",
  quantity: "",
  cost: "",
  total: 0,
};

export default function ProductSupplierBill() {
  const query = useQuery();
  const productTypeaheadRef = useRef();
  // Guard flag to prevent duplicate save/print requests
  const isSavingRef = useRef(false);
  const dispatch = useDispatch();
  const { supplierList } = useSelector((d) => d.suppliers) || [];
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const today = moment().format("YYYY-MM-DD");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: today,
    due_date: today,
    supplier_name: "",
    supplier_number: "",
    supplier_code: "",
    supplier_subhead: "",
    remark: "",
    terms: "",
    payment_type: "credit", // credit | cash
    mode_of_payment: "",
    cheque_number: "",
  });

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(initialItemForm);
  const [loading, setLoading] = useState(false);
  const [productList, setProductList] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const hasAutoSelectedSupplier = useRef(false);
  const [accountList, setAccountList] = useState([]);
  const [headList, setHeadList] = useState([]);
  const [bankAccount, setBankAccount] = useState({});
  const [accountHead, setAccountHead] = useState({});
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const cashAccountTypeaheadRef = useRef();
  const isCashPayment = form.payment_type === "cash";
  const isSplitPayment = isCashTransferSplitMode(form.mode_of_payment);

  // Editing state (legacy top-form edit; table is inline)
  const [editingItem, setEditingItem] = useState(null);
  const [extraEmptyRows, setExtraEmptyRows] = useState(0);

  // Requisitions drawer state
  const [isRequisitionsDrawerOpen, setIsRequisitionsDrawerOpen] =
    useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [loadingRequisitions, setLoadingRequisitions] = useState(false);
  const [selectedRequisitionIds, setSelectedRequisitionIds] = useState([]);
  const [dismissedPrIds, setDismissedPrIds] = useState([]);
  const [confirmDismissId, setConfirmDismissId] = useState(null);
  const [dismissingId, setDismissingId] = useState(null);

  // Branch State
  const [branches, setBranches] = useState([]);
  const [targetBranch, setTargetBranch] = useState(0); // integer branchId

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
  }, [activeBusiness?.id]);

  // Default the receiving branch to the facility's default warehouse (is_default),
  // falling back to the first branch, once branches load and nothing is chosen.
  // is_default may arrive as 1, "1", or true from the raw SQL row.
  useEffect(() => {
    if (!branches.length) return;
    const isDefaultBranch = (b) =>
      b?.is_default === 1 || b?.is_default === "1" || b?.is_default === true;
    setTargetBranch((prev) => {
      if (prev) return prev;
      const defaultBranch = branches.find(isDefaultBranch) || branches[0];
      return defaultBranch ? defaultBranch.id : 0;
    });
  }, [branches]);

  useEffect(() => {
    setBankAccount({});
    setAccountHead({});
    setAccountList([]);
    setHeadList([]);
    if (!isCashPayment || !activeBusiness?.id) return;

    const needCash =
      form.mode_of_payment === "cash" || isCashTransferSplitMode(form.mode_of_payment);
    const needBank =
      form.mode_of_payment === "bank" ||
      form.mode_of_payment === "cheque" ||
      isCashTransferSplitMode(form.mode_of_payment);

    if (needCash) {
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) setHeadList(resp?.results || []);
          else toast.error("Failed to load cash accounts.");
        },
        () => toast.error("Something went wrong while fetching cash accounts."),
      );
    }
    if (needBank) {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
        (data) => {
          if (data.success) setAccountList(data.results || []);
          else toast.error("Failed to load bank accounts");
        },
        () => toast.error("Failed to load bank accounts"),
      );
    }
  }, [form.mode_of_payment, form.payment_type, activeBusiness?.id]);

  const termOptions = [
    { value: "15", label: "15 days" },
    { value: "30", label: "30 days" },
    { value: "45", label: "45 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
  ];

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      // If terms or date changes, recalculate due date
      if (name === "terms" || name === "date") {
        const transactionDate = name === "date" ? value : updated.date;
        const terms = name === "terms" ? value : updated.terms;

        if (transactionDate && terms) {
          const days = parseInt(terms, 10);
          if (!isNaN(days) && days > 0) {
            const dueDate = moment(transactionDate)
              .add(days, "days")
              .format("YYYY-MM-DD");
            updated.due_date = dueDate;
          }
        }
      }

      return updated;
    });
  };

  const formatNumberWithCommas = (value) => {
    if (!value || value === "") return "";

    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, "");

    // Check if the value ends with a decimal point (user is typing decimal)
    const endsWithDot = numericValue.endsWith(".");

    // Split into integer and decimal parts
    const parts = numericValue.split(".");
    const integerPart = parts[0] || "";
    const decimalPart = parts[1] || "";

    // Add commas to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Combine with decimal part if exists, or preserve trailing dot
    if (decimalPart) {
      return `${formattedInteger}.${decimalPart}`;
    } else if (endsWithDot && integerPart) {
      // Preserve the decimal point if user just typed it
      return `${formattedInteger}.`;
    } else {
      return formattedInteger;
    }
  };

  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    // If value is already a number, return it as string
    if (typeof value === "number") {
      return value.toString();
    }
    // Remove commas and keep only numbers and decimal point
    return value.replace(/,/g, "");
  };

  const handleNumericInput = (value) => {
    // Allow numbers, dots, and commas
    return value.replace(/[^0-9.,]/g, "");
  };

  /** Display amount like journal entry (comma-grouped text). */
  const displayFormattedAmount = (value) => {
    if (value === "" || value == null) return "";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "";
      return formatNumberWithCommas(String(value));
    }
    return String(value);
  };

  /** Sanitize + format typed amount the same way as journal debit/credit. */
  const formatAmountInput = (value) => {
    const withoutCommas = String(value || "").replace(/,/g, "");
    const sanitizedValue = handleNumericInput(withoutCommas);
    const parts = sanitizedValue.split(".");
    const numericValue =
      parts.length > 2
        ? parts[0] + "." + parts.slice(1).join("")
        : sanitizedValue;
    return formatNumberWithCommas(numericValue);
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    const updatedItem = { ...currentItem };

    // For quantity and cost, validate and sanitize input
    if (name === "quantity" || name === "cost") {
      // Remove commas first, then sanitize
      const withoutCommas = value.replace(/,/g, "");
      const sanitizedValue = handleNumericInput(withoutCommas);

      // Prevent multiple decimal points
      const parts = sanitizedValue.split(".");
      const numericValue =
        parts.length > 2
          ? parts[0] + "." + parts.slice(1).join("")
          : sanitizedValue;

      // Format with commas for display
      const formattedValue = formatNumberWithCommas(numericValue);
      updatedItem[name] = formattedValue;

      // Calculate total using parsed values
      const qty =
        name === "quantity"
          ? parseFloat(parseNumberFromFormatted(formattedValue)) || 0
          : parseFloat(parseNumberFromFormatted(updatedItem.quantity || "")) ||
            0;
      const cost =
        name === "cost"
          ? parseFloat(parseNumberFromFormatted(formattedValue)) || 0
          : parseFloat(parseNumberFromFormatted(updatedItem.cost || "")) || 0;
      updatedItem.total = qty * cost;
    } else {
      updatedItem[name] = value;
    }

    setCurrentItem(updatedItem);
  };

  const addProductRow = (product, { quantity = 1 } = {}) => {
    if (!product?.name || !product?.sku) {
      toast.error("Please select a product");
      return;
    }
    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
    const cost = parseFloat(product.cost_price || 0) || 0;
    const taxable = normalizeTaxableStatus(product.taxable, "Taxable");
    const lineTaxId = isProductTaxable(taxable) ? defaultLineTaxId : null;
    const newItem = {
      _id: uuidv4(),
      item_name: product.name,
      sku: product.sku,
      item_type: product.item_type || "Resalable",
      taxable,
      line_tax_id: lineTaxId,
      quantity: formatNumberWithCommas(String(qty)),
      cost: cost > 0 ? formatNumberWithCommas(String(cost)) : "",
      total: qty * cost,
    };
    if (lineTaxId) {
      const tax = lineTaxOptions.find(
        (t) => String(t.id) === String(lineTaxId),
      );
      if (tax) {
        setSelectedTaxes((prev) =>
          prev.some((t) => String(t.id) === String(tax.id))
            ? prev
            : [...prev, tax],
        );
      }
    }
    setItems((prev) => [...prev, newItem]);
    toast.success("Item added");
  };

  const addItem = () => {
    if (
      !currentItem.item_name ||
      !currentItem.quantity ||
      !currentItem.cost ||
      !currentItem.item_type
    ) {
      toast.error("Please fill in all item fields");
      return;
    }

    // Parse formatted values to numbers before adding
    const qty = parseFloat(parseNumberFromFormatted(currentItem.quantity)) || 0;
    const cost = parseFloat(parseNumberFromFormatted(currentItem.cost)) || 0;

    const newItem = {
      ...currentItem,
      _id: uuidv4(),
      quantity: qty, // Store as number
      cost: cost, // Store as number
      total: qty * cost,
    };

    setItems([...items, newItem]);
    setCurrentItem(initialItemForm);

    // Clear the typeahead
    if (productTypeaheadRef.current) {
      productTypeaheadRef.current.clear();
    }

    toast.success("Item added");
  };

  // Function to handle double-click on items table row to start editing
  const handleItemDoubleClick = (item) => {
    setCurrentItem({ ...item });
    setEditingItem(item._id);
  };

  const removeItem = (id) => {
    setItems(items.filter((item) => item._id !== id));
    toast.success("Item removed");
  };

  // Function to save edited item
  const saveEditedItem = () => {
    if (
      !currentItem.item_name ||
      !currentItem.quantity ||
      !currentItem.cost ||
      !currentItem.item_type
    ) {
      toast.error("Please fill in all item fields");
      return;
    }

    // Parse formatted values to numbers before saving
    const qty = parseFloat(parseNumberFromFormatted(currentItem.quantity)) || 0;
    const cost = parseFloat(parseNumberFromFormatted(currentItem.cost)) || 0;

    setItems(
      items.map((item) =>
        item._id === editingItem
          ? {
              ...currentItem,
              quantity: qty, // Store as number
              cost: cost, // Store as number
              total: qty * cost,
            }
          : item,
      ),
    );

    setEditingItem(null);
    setCurrentItem(initialItemForm);

    // Clear the typeahead
    if (productTypeaheadRef.current) {
      productTypeaheadRef.current.clear();
    }

    toast.success("Item updated");
  };

  // Function to cancel editing
  const cancelEditing = () => {
    setEditingItem(null);
    setCurrentItem(initialItemForm);

    // Clear the typeahead
    if (productTypeaheadRef.current) {
      productTypeaheadRef.current.clear();
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
  };

  // Get VAT policy from business
  const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";

  const isTaxInclusive = (tax) => {
    if (!tax) return false;
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
  };

  // Filter taxes based on vat_policy (line tax options — same as Make Sale)
  const filteredTaxes = useMemo(() => {
    if (!taxes || taxes.length === 0) return [];

    if (vatPolicy === "all") {
      return taxes;
    } else if (vatPolicy === "vat_inclusive") {
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

  const lineTaxOptions = filteredTaxes;
  const defaultLineTaxId = useMemo(
    () => lineTaxOptions[0]?.id ?? null,
    [lineTaxOptions],
  );

  // Calculate tax amount based on tax's inclusive_type
  const calculateTaxAmount = (baseAmount, tax) => {
    if (!tax || !tax.rate) return 0;

    const rate = parseFloat(tax.rate);
    const isInclusive = isTaxInclusive(tax);

    if (isInclusive) {
      if (tax.rate_type === "percentage") {
        const rateDecimal = rate / 100;
        if (rateDecimal === 0) return 0;
        return baseAmount - baseAmount / (1 + rateDecimal);
      }
      return rate;
    }
    if (tax.rate_type === "percentage") {
      return (baseAmount * rate) / 100;
    }
    return rate;
  };

  const getLineTax = (item) => {
    if (!item?.line_tax_id) return null;
    return (
      lineTaxOptions.find((t) => String(t.id) === String(item.line_tax_id)) ||
      null
    );
  };

  const getLineTaxAmount = (item) => {
    if (!isProductTaxable(item.taxable)) return 0;
    const tax = getLineTax(item);
    if (!tax) return 0;
    return calculateTaxAmount(parseFloat(item.total || 0), tax);
  };

  // Keep selectedTaxes in sync with per-line tax picks (Make Sale pattern)
  useEffect(() => {
    const usedIds = new Set(
      items
        .filter((i) => isProductTaxable(i.taxable) && i.line_tax_id)
        .map((i) => String(i.line_tax_id)),
    );
    setSelectedTaxes(lineTaxOptions.filter((t) => usedIds.has(String(t.id))));
  }, [items, lineTaxOptions]);

  // Calculate taxable subtotal (only from taxable items)
  const calculateTaxableSubtotal = () => {
    return items
      .filter((item) => isProductTaxable(item.taxable) && item.line_tax_id)
      .reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
  };

  // Per-line tax total (like Make Sale line tax)
  const calculateTotalTax = () => {
    return items.reduce((sum, item) => sum + getLineTaxAmount(item), 0);
  };

  // Grand total: subtotal + exclusive line tax only (inclusive already in cost)
  const getTotalWithTax = () => {
    const subtotal = calculateTotal();
    let exclusiveVAT = 0;
    items.forEach((item) => {
      if (!isProductTaxable(item.taxable)) return;
      const tax = getLineTax(item);
      if (!tax || isTaxInclusive(tax)) return;
      exclusiveVAT += calculateTaxAmount(parseFloat(item.total || 0), tax);
    });
    return subtotal + exclusiveVAT;
  };

  const getItemCost = (item) =>
    typeof item?.cost === "number"
      ? item.cost
      : parseFloat(parseNumberFromFormatted(item?.cost || "")) || 0;

  const getItemQty = (item) =>
    typeof item?.quantity === "number"
      ? item.quantity
      : parseFloat(parseNumberFromFormatted(item?.quantity || "")) || 0;

  const findInvalidCostItem = () =>
    items.find((item) => getItemCost(item) <= 0);

  // Recover if loading was left true after a validation failure (e.g. empty remark / zero cost).
  useEffect(() => {
    if (!loading) return;
    const hasZeroCost = items.some((item) => {
      const cost =
        typeof item?.cost === "number"
          ? item.cost
          : parseFloat(parseNumberFromFormatted(item?.cost || "")) || 0;
      return cost <= 0;
    });
    const stuckInvalid =
      !String(form.remark || "").trim() ||
      !form.supplier_number ||
      items.length === 0 ||
      hasZeroCost;
    if (!stuckInvalid) return;
    setLoading(false);
    isSavingRef.current = false;
  }, [loading, form.remark, form.supplier_number, items]);

  // Actual save function
  const savePurchase = (
    usePrepayment = false,
    shouldPrintAfterSave = false,
  ) => {
    const resetSaving = () => {
      setLoading(false);
      isSavingRef.current = false;
    };

    if (!String(form.remark || "").trim()) {
      toast.error("Please input remark");
      resetSaving();
      return;
    }

    if (!form.supplier_number) {
      toast.error("Please select a supplier");
      resetSaving();
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      resetSaving();
      return;
    }

    const zeroCostItem = findInvalidCostItem();
    if (zeroCostItem) {
      toast.error(
        `Unit cost cannot be zero for "${zeroCostItem.item_name || zeroCostItem.sku || "item"}"`,
      );
      resetSaving();
      return;
    }

    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      resetSaving();
      return;
    }

    if (isCashPayment) {
      if (!form.mode_of_payment) {
        toast.error("Please select mode of payment");
        resetSaving();
        return;
      }
      if (isSplitPayment) {
        const cash = parseMoneyInput(cashAmount);
        const transfer = parseMoneyInput(transferAmount);
        const billTotal = getTotalWithTax();
        if (cash <= 0 || transfer <= 0) {
          toast.error("Enter both cash and transfer amounts");
          resetSaving();
          return;
        }
        if (Math.abs(cash + transfer - billTotal) > 0.02) {
          toast.error(
            `Cash + Transfer must equal bill total (₦${billTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
          );
          resetSaving();
          return;
        }
        if (!accountHead?.head) {
          toast.error("Please select a cash account");
          resetSaving();
          return;
        }
        if (!bankAccount?.id) {
          toast.error("Please select a bank account");
          resetSaving();
          return;
        }
      } else {
        if (form.mode_of_payment === "cash" && !accountHead?.head) {
          toast.error("Please select a cash account");
          resetSaving();
          return;
        }
        if (
          ["bank", "cheque"].includes(form.mode_of_payment) &&
          !bankAccount?.id
        ) {
          toast.error("Please select a bank account");
          resetSaving();
          return;
        }
        if (form.mode_of_payment === "cheque" && !form.cheque_number) {
          toast.error("Please enter a cheque number");
          resetSaving();
          return;
        }
      }
    }

    // Prepare purchase data with items - parse formatted values
    const purchaseData = items.map((item) => ({
      ...item,
      item_code: item.sku,
      cost: getItemCost(item),
      qty: getItemQty(item),
    }));

    // Aggregate per-line taxes for API (Make Sale–style line tax)
    const taxAmount = calculateTotalTax();
    const taxTotals = new Map();
    items.forEach((item) => {
      if (!isProductTaxable(item.taxable) || !item.line_tax_id) return;
      const tax = getLineTax(item);
      if (!tax) return;
      const amount = calculateTaxAmount(parseFloat(item.total || 0), tax);
      const key = String(tax.id);
      if (taxTotals.has(key)) {
        taxTotals.get(key).amount += amount;
      } else {
        taxTotals.set(key, {
          id: tax.id,
          name: tax.description || tax.name,
          description: tax.description,
          rate: parseFloat(tax.rate),
          head: tax.account_sub_head,
          amount,
          tax_type:
            tax.inclusive_type ||
            (vatPolicy === "vat_inclusive" ? "inclusive" : "exclusive"),
          rate_type: tax.rate_type || "percentage",
          inclusive_type: tax.inclusive_type,
        });
      }
    });
    const taxesArray = Array.from(taxTotals.values());

    // Credit → A/P via purchase-stock. Cash → inventory Dr / cash-bank Cr via direct-consumables.
    const endpoint = isCashPayment
      ? `/account/direct-consumables`
      : `/account/purchase-stock`;
    _postApi(
      endpoint,
      {
        target_department: null,
        target_branch_id: targetBranch || 0,
        data: purchaseData,
        facilityId: activeBusiness._id || activeBusiness.id,
        payable_code: activeBusiness.payable_code,
        supplier_advance: activeBusiness.payable_accural_code,
        user_id: user.id,
        supplier_no: form.supplier_number,
        terms: isCashPayment ? "0" : form.terms,
        remark: form.remark,
        transaction_date: form.date,
        due_date: isCashPayment ? form.date : form.due_date,
        apply_prepayment: isCashPayment ? false : usePrepayment,
        tax_amount: taxAmount,
        taxes: taxesArray,
        mode_of_payment: isCashPayment ? form.mode_of_payment : undefined,
        bankAccount: isCashPayment ? bankAccount : undefined,
        accountHead: isCashPayment ? accountHead : undefined,
        cheque_number: isCashPayment ? form.cheque_number : undefined,
        payment_splits: isCashPayment
          ? buildPaymentSplits({
              mode: form.mode_of_payment,
              cashAmount,
              transferAmount,
              accountHead,
              bankAccount,
            })
          : undefined,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Purchase recorded successfully");
          setLoading(false);
          isSavingRef.current = false;

          // Mark requisitions used on this bill as Converted so they cannot be re-billed
          if (selectedRequisitionIds.length > 0 && activeBusiness?.id) {
            const invoiceRef =
              res.data?.reference ||
              res.data?.invoice_ref ||
              res.invoice_ref ||
              res.data?.ref_number ||
              res.ref_number;
            selectedRequisitionIds.forEach((pr_no) => {
              _postApi(
                "/account/update-pr-status",
                {
                  pr_no,
                  status: "Converted",
                  facilityId: activeBusiness.id || activeBusiness._id,
                  invoice_ref: invoiceRef,
                },
                () => {},
                () => {},
              );
            });
            setSelectedRequisitionIds([]);
          }

          // Navigate to print page if shouldPrintAfterSave is true
          if (shouldPrintAfterSave) {
            // The API returns invoice_ref as 'reference' in the data object
            const invoiceRef =
              res.data?.reference ||
              res.data?.invoice_ref ||
              res.invoice_ref ||
              res.data?.ref_number ||
              res.ref_number;

            console.log("Navigation Debug - Full response:", res);
            console.log("Navigation Debug - Invoice Ref:", invoiceRef);
            console.log(
              "Navigation Debug - Should Print:",
              shouldPrintAfterSave,
            );

            if (invoiceRef) {
              const printUrl = `/app/expenses/billing/product-supplier-bill-pdf?invoice_ref=${invoiceRef}`;
              console.log("Navigation Debug - Navigating to:", printUrl);
              navigate(printUrl);
            } else {
              // If no invoice_ref, try to navigate with transaction_ref or other identifier
              const transactionRef =
                res.data?.transaction_ref ||
                res.transaction_ref ||
                res.data?.id ||
                res.id;
              if (transactionRef) {
                const printUrl = `/app/expenses/billing/product-supplier-bill-pdf?invoice_ref=${transactionRef}`;
                console.log(
                  "Navigation Debug - Using transaction ref:",
                  printUrl,
                );
                navigate(printUrl);
              } else {
                console.error("Purchase response for debugging:", res);
                toast.error(
                  "Unable to generate print page. Invoice reference not found.",
                );
                navigate(-1);
              }
            }
          } else {
            navigate(-1);
          }
        } else {
          toast.error(res.message || "Failed to save purchase");
          console.error("Purchase response:", res);
          setLoading(false);
          isSavingRef.current = false;
        }
      },
      (err) => {
        toast.error(err.message);
        console.error(err);
        setLoading(false);
        isSavingRef.current = false;
      },
    );
  };

  const handleDirectPurchase = (printAfterSave = false) => {
    // Hard guard: if a purchase save is already in progress, ignore further clicks
    if (isSavingRef.current || loading) {
      return;
    }

    if (!String(form.remark || "").trim()) {
      toast.error("Please input remark");
      return;
    }

    if (!form.supplier_number) {
      toast.error("Please select a supplier");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    const zeroCostItem = findInvalidCostItem();
    if (zeroCostItem) {
      toast.error(
        `Unit cost cannot be zero for "${zeroCostItem.item_name || zeroCostItem.sku || "item"}"`,
      );
      return;
    }

    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      return;
    }

    // At this point, validation passed; mark saving in progress so
    // buttons cannot be clicked again until the save finishes.
    isSavingRef.current = true;
    setLoading(true);

    // Cash bills pay immediately — no advance flow.
    if (isCashPayment) {
      savePurchase(false, printAfterSave);
      return;
    }

    // Do not auto-apply supplier advance here — apply manually via Pay Bills.
    savePurchase(false, printAfterSave);
  };

  const getProducts = () => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/api/products/list-by-type/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setProductList(resp.data);
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching products.");
      },
    );
  };

  const getTaxes = () => {
    if (!activeBusiness?.id) return;

    setLoadingTaxes(true);
    const taxCategory = encodeURIComponent("Purchase");
    _fetchApi(
      `/api/get-taxes-by-category?facilityId=${activeBusiness.id}&tax_category=${taxCategory}`,
      (response) => {
        if (response.success) {
          const fetchedTaxes = response.results || [];
          setTaxes(fetchedTaxes);

          // Don't auto-select taxes - let user choose based on vat_policy
          // Auto-selection removed to match MakeSale.jsx behavior
        }
        setLoadingTaxes(false);
      },
      (err) => {
        console.error("Error fetching taxes:", err);
        setLoadingTaxes(false);
      },
    );
  };

  // Fetch approved purchase requisitions with items using the new API
  const fetchApprovedRequisitions = () => {
    if (!activeBusiness?.id) return;

    setLoadingRequisitions(true);
    _fetchApi(
      `/account/get-approved-prs-with-items/${activeBusiness.id}/${user.id}`,
      (data) => {
        setLoadingRequisitions(false);
        if (data.success) {
          // PRs now include items array, item_count, and total_item_cost
          setRequisitions(data.results);
        } else {
          toast.error("Failed to fetch requisitions");
          setRequisitions([]);
        }
      },
      (err) => {
        setLoadingRequisitions(false);
        console.error("Error fetching requisitions:", err);
        toast.error("Error fetching requisitions");
        setRequisitions([]);
      },
    );
  };

  // Handle opening requisitions drawer
  const handleOpenRequisitionsDrawer = () => {
    setIsRequisitionsDrawerOpen(true);
    fetchApprovedRequisitions();
  };

  const resolveWarehouseFromPr = (requisition) => {
    const rawId = requisition?.branch_id;
    if (rawId != null && rawId !== "" && rawId !== "all") {
      const n = parseInt(rawId, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const name = String(requisition?.branch || "").trim();
    if (!name || !branches.length) return null;
    const match = branches.find(
      (b) =>
        String(b.branch_name || "").toLowerCase() === name.toLowerCase(),
    );
    return match ? Number(match.id) : null;
  };

  const warehouseLabelForPr = (requisition) => {
    const name = String(requisition?.branch || "").trim();
    if (name) return name;
    const id = requisition?.branch_id;
    if (id != null && id !== "" && id !== "all") {
      const match = branches.find((b) => String(b.id) === String(id));
      if (match?.branch_name) return match.branch_name;
    }
    return "No warehouse assigned";
  };

  // Add requisition items to the current items list
  // Items are now already included in the requisition object from the API
  const addRequisitionItems = (requisition) => {
    // Check if requisition has items
    if (!requisition.items || requisition.items.length === 0) {
      toast.error("No items found in this requisition");
      return false;
    }

    if (selectedRequisitionIds.includes(requisition.pr_no)) {
      toast.info(`Requisition ${requisition.pr_no} was already added`);
      return false;
    }

    // Map the items from the requisition to the format expected by the items list
    const requisitionItems = requisition.items.map((item) => {
      const quantity = item.quantity || 1;
      const cost = item.unit_cost || item.cost || 0;

      // Try to find matching product to derive taxable flag
      const matchedProduct =
        productList.find(
          (p) =>
            p.sku === (item.item_code || item.sku) || p.name === item.item_name,
        ) || null;

      const taxable = normalizeTaxableStatus(
        matchedProduct?.taxable || item.taxable,
        "Non-Taxable",
      );
      return {
        _id: uuidv4(),
        item_name: item.item_name || "",
        sku: item.item_code || "",
        quantity,
        cost,
        total: parseFloat(quantity) * parseFloat(cost),
        item_type: item.item_type || matchedProduct?.item_type || "",
        taxable,
        line_tax_id: isProductTaxable(taxable) ? defaultLineTaxId : null,
      };
    });

    // Append items (functional update so multiple PRs can be added in one drawer session)
    setItems((prev) => [...prev, ...requisitionItems]);

    // Auto-fill warehouse from the PR
    const warehouseId = resolveWarehouseFromPr(requisition);
    if (warehouseId) {
      setTargetBranch(warehouseId);
    }

    const prDate = requisition.date
      ? moment(requisition.date).format("YYYY-MM-DD")
      : null;

    // Supplier, date, remark, payable account from the requisition
    const supplierNo =
      requisition.supplier_number ||
      requisition.supplier_no ||
      requisition.supplier_code;

    setForm((prev) => {
      const next = { ...prev };

      if (requisition.supplier_name || supplierNo) {
        next.supplier_name = requisition.supplier_name || prev.supplier_name;
        next.supplier_number = supplierNo || prev.supplier_number;
        next.supplier_code = requisition.supplier_code || prev.supplier_code;
        next.supplier_subhead =
          requisition.supplier_subhead ||
          requisition.account_code ||
          prev.supplier_subhead;
      } else if (requisition.account_code && !prev.supplier_subhead) {
        next.supplier_subhead = requisition.account_code;
      }

      if (prDate) {
        next.date = prDate;
        const termsDays = parseInt(prev.terms, 10);
        if (Number.isFinite(termsDays) && termsDays > 0) {
          next.due_date = moment(prDate)
            .add(termsDays, "days")
            .format("YYYY-MM-DD");
        } else if (
          !prev.due_date ||
          prev.due_date === prev.date ||
          prev.due_date === today
        ) {
          next.due_date = prDate;
        }
      }

      if (requisition.reason && !String(prev.remark || "").trim()) {
        next.remark = requisition.reason;
      }

      return next;
    });

    // Track which PRs were already added (still allow adding other PRs)
    setSelectedRequisitionIds((prev) =>
      prev.includes(requisition.pr_no) ? prev : [...prev, requisition.pr_no],
    );

    toast.success(
      `Added ${requisitionItems.length} item(s) from requisition ${requisition.pr_no}`,
    );
    return true;
  };

  useEffect(() => {
    dispatch(getSuppliers());
    getProducts();
    getTaxes();
  }, []);

  // Auto-select supplier from query parameter
  useEffect(() => {
    const supplierCode = query.get("supplier_code");
    if (
      supplierCode &&
      supplierList.length > 0 &&
      !form.supplier_number &&
      !hasAutoSelectedSupplier.current
    ) {
      const supplier = supplierList.find(
        (s) =>
          s.supplier_code === supplierCode ||
          s.supplier_number === supplierCode,
      );
      if (supplier) {
        hasAutoSelectedSupplier.current = true;
        setForm((prev) => ({
          ...prev,
          supplier_name: supplier.supplier_name,
          supplier_code: supplier.supplier_code,
          supplier_subhead: supplier.supplier_subhead,
          supplier_number: supplier.supplier_number,
        }));
      }
    }
  }, [supplierList, query, form.supplier_number]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <div className="relative min-h-screen bg-white">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center rounded-lg bg-white p-8 shadow-2xl">
            <div className="mb-4 h-16 w-16 animate-spin rounded-full border-b-4 border-[var(--aa-accent)]" />
            <h3 className="mb-2 text-xl font-bold text-gray-800">
              Processing Bill...
            </h3>
            <p className="text-sm text-gray-600">
              Please wait while we record your purchase
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col bg-white">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText
                className="size-6 text-[var(--aa-accent)]"
                strokeWidth={1.75}
              />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  New Product Bill
                </h1>
                <p className="text-xs text-slate-500">
                  Record supplier product purchases into warehouse stock
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenRequisitionsDrawer}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aa-accent)] hover:underline"
            >
              View Purchase Orders
              <ExternalLink size={14} />
            </button>
          </div>
          {(!form.supplier_number ||
            !String(form.remark || "").trim() ||
            items.length === 0 ||
            !!findInvalidCostItem()) && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {!form.supplier_number && (
                <span className="mr-3">Select a supplier.</span>
              )}
              {!String(form.remark || "").trim() && (
                <span className="mr-3">Enter a remark / description.</span>
              )}
              {items.length === 0 && (
                <span className="mr-3">
                  Enter a valid item name or description.
                </span>
              )}
              {items.length > 0 && findInvalidCostItem() && (
                <span>Unit cost cannot be zero.</span>
              )}
            </div>
          )}
        </div>

        {/* Header form fields — invoice-style label | control rows */}
        <div className="shrink-0 space-y-4 border-b border-slate-100 bg-white px-6 py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
            <label className="text-sm font-medium text-slate-600 lg:text-right">
              Payment Type <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-medium transition-colors ${
                  !isCashPayment
                    ? "text-[var(--aa-accent)]"
                    : "text-slate-400"
                }`}
              >
                Credit
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isCashPayment}
                aria-label="Payment type"
                onClick={() =>
                  setForm((p) => {
                    const next = p.payment_type === "cash" ? "credit" : "cash";
                    return {
                      ...p,
                      payment_type: next,
                      mode_of_payment:
                        next === "credit" ? "" : p.mode_of_payment,
                      cheque_number:
                        next === "credit" ? "" : p.cheque_number,
                    };
                  })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aa-accent)] focus-visible:ring-offset-2 ${
                  isCashPayment
                    ? "bg-[var(--aa-accent)]"
                    : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    isCashPayment ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium transition-colors ${
                  isCashPayment
                    ? "text-[var(--aa-accent)]"
                    : "text-slate-400"
                }`}
              >
                Cash
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
            <label className="text-sm font-medium text-slate-600 lg:text-right">
              Supplier <span className="text-red-500">*</span>
            </label>
            <div>
              <select
                name="supplier_number"
                value={form.supplier_number}
                onChange={(e) => {
                  const selectedSupplier = supplierList.find(
                    (s) => s.supplier_number === e.target.value,
                  );
                  if (selectedSupplier) {
                    setForm((p) => ({
                      ...p,
                      supplier_name: selectedSupplier.supplier_name,
                      supplier_code: selectedSupplier.supplier_code,
                      supplier_subhead: selectedSupplier.supplier_subhead,
                      supplier_number: selectedSupplier.supplier_number,
                    }));
                  } else if (e.target.value === "") {
                    setForm((p) => ({
                      ...p,
                      supplier_name: "",
                      supplier_code: "",
                      supplier_subhead: "",
                      supplier_number: "",
                    }));
                  }
                }}
                className={`h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)] ${
                  !form.supplier_number ? "text-slate-400" : "text-slate-800"
                }`}
              >
                <option value="">Select supplier...</option>
                {form.supplier_number &&
                  !supplierList?.some(
                    (s) => s.supplier_number === form.supplier_number,
                  ) && (
                    <option value={form.supplier_number}>
                      {form.supplier_name || form.supplier_number}
                    </option>
                  )}
                {supplierList?.map((supplier) => (
                  <option
                    key={supplier.supplier_number}
                    value={supplier.supplier_number}
                  >
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
              {form.supplier_number && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Supplier No:{" "}
                  <span className="font-medium">{form.supplier_number}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,1fr)] lg:items-start">
            <span className="pt-2 text-sm font-medium text-slate-600 lg:text-right">
              Bill Date <span className="text-red-500">*</span>
            </span>
            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
              />
              {!isCashPayment && (
                <>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Terms</label>
                    <div className="w-44">
                      <CreatableSelect
                        className="w-full text-sm"
                        classNamePrefix="react-select"
                        placeholder="Terms"
                        options={termOptions}
                        value={
                          termOptions.find((opt) => opt.value === form.terms) ||
                          (form.terms
                            ? { value: form.terms, label: `${form.terms} days` }
                            : null)
                        }
                        onChange={(selected) => {
                          const termsValue = selected?.value || "";
                          handleFormChange({
                            target: { name: "terms", value: termsValue },
                          });
                          if (termsValue && form.date) {
                            const days = parseInt(termsValue, 10);
                            if (!isNaN(days) && days > 0) {
                              const dueDate = moment(form.date)
                                .add(days, "days")
                                .format("YYYY-MM-DD");
                              setForm((prev) => ({
                                ...prev,
                                due_date: dueDate,
                              }));
                            }
                          }
                        }}
                        isClearable
                        formatCreateLabel={(input) => `Add "${input} days"`}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            minHeight: 36,
                            height: 36,
                            borderRadius: 6,
                            borderColor: state.isFocused
                              ? "var(--aa-accent)"
                              : "#cbd5e1",
                            boxShadow: state.isFocused
                              ? "0 0 0 1px var(--aa-accent)"
                              : "none",
                            "&:hover": { borderColor: "#cbd5e1" },
                          }),
                          valueContainer: (base) => ({
                            ...base,
                            paddingTop: 0,
                            paddingBottom: 0,
                          }),
                          indicatorsContainer: (base) => ({
                            ...base,
                            height: 34,
                          }),
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-600">Due Date</label>
                    <input
                      type="date"
                      name="due_date"
                      value={form.due_date}
                      onChange={handleFormChange}
                      min={form.date}
                      className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
            <label className="text-sm font-medium text-slate-600 lg:text-right">
              Warehouse
            </label>
            <select
              value={targetBranch}
              onChange={(e) =>
                setTargetBranch(parseInt(e.target.value, 10) || 0)
              }
              className="h-9 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
            >
              <option value={0}>Select warehouse...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name}
                </option>
              ))}
            </select>
          </div>

          {!isCashPayment ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-center">
              <label className="text-sm font-medium text-slate-600 lg:text-right">
                Accounts Payable
              </label>
              <input
                type="text"
                readOnly
                value={
                  activeBusiness?.payable_code
                    ? `${activeBusiness.payable_code}${
                        form.supplier_name ? ` · ${form.supplier_name}` : ""
                      }`
                    : "Default payable account"
                }
                className="h-9 w-full max-w-md rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700 outline-none"
              />
            </div>
          ) : (
            <CashTransferPaymentFields
              modeOfPayment={form.mode_of_payment}
              onModeChange={(value) => {
                setForm((p) => ({
                  ...p,
                  mode_of_payment: value,
                  cheque_number: value === "cheque" ? p.cheque_number : "",
                }));
                setCashAmount("");
                setTransferAmount("");
              }}
              cashAmount={cashAmount}
              onCashAmountChange={setCashAmount}
              transferAmount={transferAmount}
              onTransferAmountChange={setTransferAmount}
              expectedTotal={getTotalWithTax()}
              accountHead={accountHead}
              onAccountHeadChange={setAccountHead}
              bankAccount={bankAccount}
              onBankAccountChange={(acc) => setBankAccount(acc || {})}
              accountList={accountList}
              headList={headList}
              chequeNumber={form.cheque_number}
              onChequeNumberChange={(v) =>
                setForm((p) => ({ ...p, cheque_number: v }))
              }
              cashTypeaheadRef={cashAccountTypeaheadRef}
            />
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[9rem_minmax(0,28rem)] lg:items-start">
            <label className="pt-2 text-sm font-medium text-slate-600 lg:text-right">
              Remark <span className="text-red-500">*</span>
            </label>
            <textarea
              name="remark"
              value={form.remark}
              onChange={handleFormChange}
              placeholder="Enter transaction description..."
              rows={2}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
            />
          </div>
        </div>

        {/* Item Table */}
        <div className="flex w-full flex-1 flex-col bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Item Table
            </p>
            <span className="text-xs text-slate-500">
              VAT:{" "}
              {activeBusiness?.vat_policy === "vat_inclusive"
                ? "Inclusive"
                : activeBusiness?.vat_policy === "vat_exclusive"
                  ? "Exclusive"
                  : "All"}
            </span>
          </div>

          <div className="w-full overflow-x-auto px-4 sm:px-6">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="min-w-[280px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                    Item Details
                  </th>
                  <th className="min-w-[8.5rem] w-36 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Quantity
                  </th>
                  <th className="min-w-[10rem] w-44 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Unit Cost
                  </th>
                  <th className="w-40 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                    Tax
                  </th>
                  <th className="w-32 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="w-10 px-1 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(() => {
                  const emptyRowCount = Math.max(1, 1 + extraEmptyRows);
                  const rows = [];

                  items.forEach((item) => {
                    const lineVat = getLineTaxAmount(item);
                    rows.push(
                      <tr
                        key={item._id}
                        className="bg-white hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3 align-top">
                          <Typeahead
                            id={`item-name-typeahead-${item._id}`}
                            labelKey={(product) =>
                              `${product.name || ""} - ${product.sku || ""}`
                            }
                            options={productList}
                            placeholder="Type or click to select a product"
                            onChange={(selected) => {
                              if (selected && selected.length > 0) {
                                const product = selected[0];
                                const qty =
                                  typeof item.quantity === "number"
                                    ? item.quantity
                                    : parseFloat(
                                        parseNumberFromFormatted(
                                          item.quantity || "",
                                        ),
                                      ) || 0;
                                const costNum =
                                  parseFloat(product.cost_price || 0) || 0;
                                const total = qty * costNum;
                                const taxable = normalizeTaxableStatus(
                                  product.taxable,
                                  "Taxable",
                                );
                                const lineTaxId = isProductTaxable(taxable)
                                  ? item.line_tax_id || defaultLineTaxId
                                  : null;
                                setItems((prev) =>
                                  prev.map((i) =>
                                    i._id === item._id
                                      ? {
                                          ...i,
                                          item_name: product.name || "",
                                          sku: product.sku || "",
                                          item_type: product.item_type,
                                          taxable,
                                          line_tax_id: lineTaxId,
                                          cost:
                                            costNum > 0
                                              ? formatNumberWithCommas(
                                                  String(costNum),
                                                )
                                              : "",
                                          total,
                                        }
                                      : i,
                                  ),
                                );
                              } else {
                                setItems((prev) =>
                                  prev.map((i) =>
                                    i._id === item._id
                                      ? {
                                          ...i,
                                          item_name: "",
                                          sku: "",
                                          item_type: "",
                                        }
                                      : i,
                                  ),
                                );
                              }
                            }}
                            selected={
                              item.item_name && item.sku
                                ? productList.filter(
                                    (product) =>
                                      product.sku === item.sku &&
                                      product.name === item.item_name,
                                  )
                                : []
                            }
                            clearButton
                            renderMenuItemChildren={(option) => (
                              <div className="flex w-full items-center justify-between py-1">
                                <span className="text-sm">{option.name}</span>
                                <span className="text-xs text-slate-500">
                                  {option.sku}
                                </span>
                              </div>
                            )}
                            inputProps={{
                              className:
                                "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]",
                            }}
                            positionFixed
                          />
                          {item.sku && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <select
                                title="VAT status"
                                value={normalizeTaxableStatus(
                                  item.taxable,
                                  "Taxable",
                                )}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setItems((prev) =>
                                    prev.map((i) =>
                                      i._id === item._id
                                        ? applyLineTaxable(
                                            i,
                                            next,
                                            defaultLineTaxId,
                                          )
                                        : i,
                                    ),
                                  );
                                }}
                                className={`max-w-[8.5rem] cursor-pointer rounded-full border-0 px-1.5 py-0.5 text-[10px] font-semibold outline-none ${
                                  taxableStatusStyle(item.taxable).badgeClass
                                }`}
                              >
                                {TAXABLE_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <span className="text-xs text-slate-500">
                                {item.sku}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="min-w-[8.5rem] w-36 px-3 py-3 text-right align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            value={displayFormattedAmount(item.quantity)}
                            onChange={(e) => {
                              const formattedQty = formatAmountInput(
                                e.target.value,
                              );
                              const qty =
                                parseFloat(
                                  parseNumberFromFormatted(formattedQty),
                                ) || 0;
                              const cost = getItemCost(item);
                              setItems((prev) =>
                                prev.map((i) =>
                                  i._id === item._id
                                    ? {
                                        ...i,
                                        quantity: formattedQty,
                                        total: qty * cost,
                                      }
                                    : i,
                                ),
                              );
                            }}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          />
                        </td>
                        <td className="min-w-[10rem] w-44 px-3 py-3 text-right align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            value={displayFormattedAmount(item.cost)}
                            onChange={(e) => {
                              const formattedCost = formatAmountInput(
                                e.target.value,
                              );
                              const cost =
                                parseFloat(
                                  parseNumberFromFormatted(formattedCost),
                                ) || 0;
                              const qty = getItemQty(item);
                              setItems((prev) =>
                                prev.map((i) =>
                                  i._id === item._id
                                    ? {
                                        ...i,
                                        cost: formattedCost,
                                        total: qty * cost,
                                      }
                                    : i,
                                ),
                              );
                            }}
                            className={`h-9 w-full rounded-md border bg-white px-3 text-right text-sm outline-none focus:ring-1 ${
                              getItemCost(item) <= 0
                                ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                                : "border-slate-300 focus:border-[var(--aa-accent)] focus:ring-[var(--aa-accent)]"
                            }`}
                          />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <select
                            value={item.line_tax_id ?? ""}
                            disabled={!isProductTaxable(item.taxable)}
                            onChange={(e) => {
                              const taxId = e.target.value || null;
                              setItems((prev) =>
                                prev.map((i) => {
                                  if (i._id !== item._id) return i;
                                  if (taxId) {
                                    return {
                                      ...i,
                                      line_tax_id: taxId,
                                      taxable: "Taxable",
                                    };
                                  }
                                  return applyLineTaxable(
                                    { ...i, line_tax_id: null },
                                    isProductTaxable(i.taxable)
                                      ? "Non-Taxable"
                                      : i.taxable,
                                    defaultLineTaxId,
                                  );
                                }),
                              );
                            }}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)] disabled:bg-slate-50"
                          >
                            <option value="">Select a Tax</option>
                            {lineTaxOptions.map((tax) => (
                              <option key={tax.id} value={tax.id}>
                                {tax.description} ({tax.rate}%)
                              </option>
                            ))}
                          </select>
                          {isProductTaxable(item.taxable) && lineVat > 0 && (
                            <div className="mt-1 text-[11px] tabular-nums text-slate-500">
                              ₦{formatNumber(lineVat)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right align-top text-sm font-medium tabular-nums text-slate-900">
                          {formatNumber(item.total)}
                        </td>
                        <td className="px-1 py-3 text-center align-top">
                          <button
                            type="button"
                            onClick={() => removeItem(item._id)}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            aria-label="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>,
                    );
                  });

                  for (let i = 0; i < emptyRowCount; i++) {
                    rows.push(
                      <tr
                        key={`empty-bill-row-${i}`}
                        className="bg-white hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3 align-top">
                          <Typeahead
                            key={`empty-product-${i}-${items.length}`}
                            id={`empty-product-typeahead-${i}`}
                            labelKey={(product) =>
                              `${product.name || ""} - ${product.sku || ""}`
                            }
                            options={productList}
                            placeholder="Type or click to select a product"
                            onChange={(selected) => {
                              if (selected && selected.length > 0) {
                                addProductRow(selected[0]);
                                setExtraEmptyRows((n) => n - 1);
                              }
                            }}
                            selected={[]}
                            renderMenuItemChildren={(option) => (
                              <div className="flex w-full items-center justify-between py-1">
                                <span className="text-sm">{option.name}</span>
                                <span className="text-xs text-slate-500">
                                  ₦{formatNumber(option.cost_price || 0)}
                                </span>
                              </div>
                            )}
                            inputProps={{
                              className:
                                "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]",
                            }}
                            positionFixed
                          />
                        </td>
                        <td className="min-w-[8.5rem] w-36 px-3 py-3 text-right align-top text-sm text-slate-400">
                          1.00
                        </td>
                        <td className="min-w-[10rem] w-44 px-3 py-3 text-right align-top text-sm text-slate-400">
                          0.00
                        </td>
                        <td className="px-2 py-3 align-top">
                          <select
                            disabled
                            className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 px-2 text-sm text-slate-400"
                            defaultValue=""
                          >
                            <option value="">Select a Tax</option>
                          </select>
                        </td>
                        <td className="px-2 py-3 text-right align-top text-sm text-slate-400">
                          0.00
                        </td>
                        <td className="px-1 py-3 text-center align-top">
                          <button
                            type="button"
                            onClick={() => {
                              if (emptyRowCount <= 1) return;
                              setExtraEmptyRows((n) => n - 1);
                            }}
                            disabled={emptyRowCount <= 1}
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                            aria-label="Remove empty row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>,
                    );
                  }

                  return rows;
                })()}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
            <button
              type="button"
              onClick={() => setExtraEmptyRows((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[var(--aa-accent)] hover:bg-slate-50"
            >
              <Plus size={15} />
              Add New Row
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  setExtraEmptyRows(0);
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Clear all lines
              </button>
            )}
          </div>

          <div className="mt-4 flex justify-end px-6 pb-4">
            <div className="w-full max-w-xs space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-600">Sub Total</span>
                <span className="tabular-nums text-slate-900">
                  {formatNumber(calculateTotal())}
                </span>
              </div>
              {selectedTaxes.length > 0 &&
                calculateTotalTax() > 0 &&
                selectedTaxes.map((tax) => {
                  const taxAmountForDisplay = items.reduce((sum, item) => {
                    if (
                      !isProductTaxable(item.taxable) ||
                      String(item.line_tax_id) !== String(tax.id)
                    ) {
                      return sum;
                    }
                    return (
                      sum + calculateTaxAmount(parseFloat(item.total || 0), tax)
                    );
                  }, 0);
                  return (
                    <div
                      key={tax.id}
                      className="flex items-center justify-between gap-4"
                    >
                      <span className="text-slate-600">
                        {tax.description} ({tax.rate}%)
                      </span>
                      <span className="tabular-nums text-slate-900">
                        {formatNumber(taxAmountForDisplay)}
                      </span>
                    </div>
                  );
                })}
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                <span className="text-base font-semibold text-slate-900">
                  Total (NGN)
                </span>
                <span className="text-lg font-bold tabular-nums text-slate-900">
                  {formatNumber(getTotalWithTax())}
                </span>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#f7f7f8] px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDirectPurchase(false)}
                disabled={loading || items.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-[var(--aa-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--aa-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Processing...
                  </>
                ) : (
                  "Save Bill"
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDirectPurchase(true)}
                disabled={loading || items.length === 0}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save and print
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoading(false);
                  isSavingRef.current = false;
                  navigate(-1);
                }}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold text-slate-900">
                Total Amount:{" "}
                <span className="text-slate-800">
                  NGN {formatNumber(getTotalWithTax())}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Total Quantity:{" "}
                {formatNumber(
                  items.reduce((sum, item) => sum + getItemQty(item), 0),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Requisitions Drawer */}
      <Drawer
        open={isRequisitionsDrawerOpen}
        onOpenChange={(open) => {
          setIsRequisitionsDrawerOpen(open);
          if (!open) {
            setConfirmDismissId(null);
            setDismissingId(null);
          }
        }}
      >
        <DrawerContent
          side="right"
          className="flex h-full !w-[600px] max-w-[600px] flex-col border-l border-slate-200 bg-white"
        >
          <DrawerHeader className="shrink-0 border-b border-slate-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)]">
                  <FileText size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="text-lg font-semibold tracking-tight text-slate-900">
                    Approved Purchase Requisitions
                  </DrawerTitle>
                  <DrawerDescription className="mt-1 text-xs text-slate-500">
                    Add one or more requisitions — drawer stays open until you
                    close it
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  onClick={() => setSelectedRequisitionIds([])}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
            {loadingRequisitions ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-5 w-5 animate-spin text-[var(--aa-navy)]" />
                <span className="ml-2 text-sm text-slate-500">
                  Loading requisitions...
                </span>
              </div>
            ) : requisitions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)]">
                  <FileText size={22} />
                </div>
                <p className="mb-1 text-sm font-medium text-slate-800">
                  No approved requisitions found
                </p>
                <p className="text-xs text-slate-500">
                  There are no approved purchase requisitions available
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requisitions
                  .filter((r) => !dismissedPrIds.includes(r.pr_no))
                  .map((requisition) => {
                    const warehouseLabel = warehouseLabelForPr(requisition);
                    return (
                    <div
                      key={requisition.pr_no || requisition._id}
                      className={`py-5 transition-colors ${
                        confirmDismissId === requisition.pr_no
                          ? "bg-rose-50/60"
                          : selectedRequisitionIds.includes(requisition.pr_no)
                            ? "opacity-50"
                            : ""
                      }`}
                    >
                      {confirmDismissId === requisition.pr_no ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                          <p className="text-center text-sm font-semibold text-rose-700">
                            Dismiss{" "}
                            <span className="font-bold">
                              {requisition.pr_no}
                            </span>
                            ?
                          </p>
                          <p className="text-center text-xs text-slate-500">
                            This will change the status to{" "}
                            <strong>Dismissed</strong> and remove it from this
                            list permanently.
                          </p>
                          <div className="flex w-full gap-3">
                            <button
                              type="button"
                              disabled={dismissingId === requisition.pr_no}
                              onClick={() => {
                                setDismissingId(requisition.pr_no);
                                _postApi(
                                  "/account/update-pr-status",
                                  {
                                    pr_no: requisition.pr_no,
                                    status: "Dismissed",
                                    facilityId: activeBusiness?.id,
                                  },
                                  (resp) => {
                                    setDismissingId(null);
                                    if (resp?.success) {
                                      setDismissedPrIds((prev) => [
                                        ...prev,
                                        requisition.pr_no,
                                      ]);
                                      setRequisitions((prev) =>
                                        prev.filter(
                                          (r) => r.pr_no !== requisition.pr_no,
                                        ),
                                      );
                                      setConfirmDismissId(null);
                                      toast.success(
                                        `${requisition.pr_no} dismissed`,
                                      );
                                    } else {
                                      toast.error(
                                        resp?.message || "Failed to dismiss PR",
                                      );
                                    }
                                  },
                                  (err) => {
                                    setDismissingId(null);
                                    toast.error(
                                      err?.message || "Failed to dismiss PR",
                                    );
                                  },
                                );
                              }}
                              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
                            >
                              {dismissingId === requisition.pr_no ? (
                                <>
                                  <Loader className="h-3 w-3 animate-spin" />{" "}
                                  Dismissing…
                                </>
                              ) : (
                                "Yes, Dismiss"
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={dismissingId === requisition.pr_no}
                              onClick={() => setConfirmDismissId(null)}
                              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3 flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                <h3 className="font-mono text-sm font-semibold text-slate-900">
                                  {requisition.pr_no}
                                </h3>
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/80">
                                  {requisition.status}
                                </span>
                              </div>
                              {requisition.reason && (
                                <p className="mb-2 text-sm text-slate-600">
                                  {requisition.reason}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              title="Dismiss requisition"
                              onClick={() =>
                                setConfirmDismissId(requisition.pr_no)
                              }
                              className="ml-2 shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
                            {requisition.date && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span>
                                  {moment(requisition.date).format(
                                    "MMM DD, YYYY",
                                  )}
                                </span>
                              </div>
                            )}
                            {(requisition.supplier_name ||
                              requisition.supplier_number ||
                              requisition.supplier_code) && (
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-slate-400" />
                                <span className="truncate font-medium text-slate-700">
                                  {requisition.supplier_name ||
                                    requisition.supplier_number ||
                                    requisition.supplier_code}
                                </span>
                              </div>
                            )}
                            <div className="col-span-2 flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span
                                className={`truncate font-medium ${
                                  warehouseLabel === "No warehouse assigned"
                                    ? "text-slate-400 italic"
                                    : "text-slate-700"
                                }`}
                                title={warehouseLabel}
                              >
                                {warehouseLabel}
                              </span>
                            </div>
                          </div>

                          {requisition.items &&
                            requisition.items.length > 0 && (
                              <div className="mt-3 border-t border-slate-100 pt-3">
                                <div className="space-y-2">
                                  {requisition.items
                                    .slice(0, 3)
                                    .map((item, index) => (
                                      <div
                                        key={item.id || index}
                                        className="flex items-center justify-between py-1.5"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <h4 className="truncate text-sm font-medium text-slate-900">
                                            {item.item_name} {item.unit_measure}
                                          </h4>
                                          <p className="font-mono text-xs text-slate-400">
                                            {item.item_code}
                                          </p>
                                        </div>
                                        <div className="ml-3 shrink-0 text-right text-sm font-medium tabular-nums text-slate-700">
                                          Qty: {item.quantity || 1}
                                        </div>
                                      </div>
                                    ))}
                                  {requisition.items.length > 3 && (
                                    <div className="text-center text-xs text-slate-400">
                                      + {requisition.items.length - 3} more
                                      items
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                addRequisitionItems(requisition);
                              }}
                              disabled={selectedRequisitionIds.includes(
                                requisition.pr_no,
                              )}
                              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-[var(--aa-navy)] transition hover:bg-[var(--aa-sidebar-active)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {selectedRequisitionIds.includes(
                                requisition.pr_no,
                              )
                                ? "✓ Added"
                                : `Add to List (${
                                    requisition.item_count ||
                                    requisition.items?.length ||
                                    0
                                  })`}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const ok = addRequisitionItems(requisition);
                                if (ok !== false) {
                                  setIsRequisitionsDrawerOpen(false);
                                }
                              }}
                              disabled={selectedRequisitionIds.includes(
                                requisition.pr_no,
                              )}
                              className="flex-1 rounded-md border-0 bg-[var(--aa-navy)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--aa-navy)]/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add &amp; Close
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })}
              </div>
            )}
          </div>

          {selectedRequisitionIds.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-3.5">
              <p className="text-xs text-slate-500">
                {selectedRequisitionIds.length} requisition
                {selectedRequisitionIds.length === 1 ? "" : "s"} added — you can
                still add more
              </p>
              <button
                type="button"
                onClick={() => setIsRequisitionsDrawerOpen(false)}
                className="rounded-md border-0 bg-[var(--aa-navy)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--aa-navy)]/90"
              >
                Done
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
