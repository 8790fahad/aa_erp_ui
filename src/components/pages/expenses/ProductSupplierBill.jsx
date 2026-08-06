/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Save,
  Plus,
  Trash2,
  Package,
  Calendar,
  FileText,
  X,
  Loader,
  ChevronLeft,
  ChevronDown,
  Check,
  AlertCircle,
  Info,
  DollarSign,
  Printer,
  Users,
  ExternalLink,
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
import CreatableSelect from "react-select/creatable";

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
  });

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(initialItemForm);
  const [loading, setLoading] = useState(false);
  const [productList, setProductList] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const hasAutoSelectedSupplier = useRef(false);

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

  // Advance modal state
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [showAdvanceAccounting, setShowAdvanceAccounting] = useState(false);
  const [supplierBalance, setSupplierBalance] = useState(0);
  const [applyPrepayment, setApplyPrepayment] = useState(false);
  const [shouldPrint, setShouldPrint] = useState(false);

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
      (err) => console.error("Error fetching warehouses:", err)
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
    const isTaxable = (product.taxable || "Taxable") === "Taxable";
    const lineTaxId = isTaxable ? defaultLineTaxId : null;
    const newItem = {
      _id: uuidv4(),
      item_name: product.name,
      sku: product.sku,
      item_type: product.item_type || "Resalable",
      taxable: isTaxable ? "Taxable" : "Not Taxable",
      line_tax_id: lineTaxId,
      quantity: qty,
      cost,
      total: qty * cost,
    };
    if (lineTaxId) {
      const tax = lineTaxOptions.find((t) => String(t.id) === String(lineTaxId));
      if (tax) {
        setSelectedTaxes((prev) =>
          prev.some((t) => String(t.id) === String(tax.id)) ? prev : [...prev, tax]
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
          : item
      )
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
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
      );
    }
    return taxes.filter(
      (tax) =>
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
    );
  }, [taxes, vatPolicy]);

  const lineTaxOptions = filteredTaxes;
  const defaultLineTaxId = useMemo(
    () => lineTaxOptions[0]?.id ?? null,
    [lineTaxOptions]
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
      lineTaxOptions.find(
        (t) => String(t.id) === String(item.line_tax_id)
      ) || null
    );
  };

  const getLineTaxAmount = (item) => {
    if (item.taxable !== "Taxable") return 0;
    const tax = getLineTax(item);
    if (!tax) return 0;
    return calculateTaxAmount(parseFloat(item.total || 0), tax);
  };

  // Keep selectedTaxes in sync with per-line tax picks (Make Sale pattern)
  useEffect(() => {
    const usedIds = new Set(
      items
        .filter((i) => i.taxable === "Taxable" && i.line_tax_id)
        .map((i) => String(i.line_tax_id))
    );
    setSelectedTaxes(
      lineTaxOptions.filter((t) => usedIds.has(String(t.id)))
    );
  }, [items, lineTaxOptions]);

  // Calculate taxable subtotal (only from taxable items)
  const calculateTaxableSubtotal = () => {
    return items
      .filter((item) => item.taxable === "Taxable" && item.line_tax_id)
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
      if (item.taxable !== "Taxable") return;
      const tax = getLineTax(item);
      if (!tax || isTaxInclusive(tax)) return;
      exclusiveVAT += calculateTaxAmount(parseFloat(item.total || 0), tax);
    });
    return subtotal + exclusiveVAT;
  };

  // Check supplier balance from general ledger
  const checkSupplierBalance = (supplierNo, callback) => {
    _fetchApi(
      `/api/v1/get-supplier-balance/${supplierNo}/${
        activeBusiness.id || activeBusiness._id
      }`,
      (data) => {
        if (data.success) {
          const balance = parseFloat(data.balance || 0);
          callback(balance);
        } else {
          callback(0);
        }
      },
      (err) => {
        console.error("Error checking supplier balance:", err);
        callback(0);
      }
    );
  };

  // Actual save function
  const savePurchase = (
    usePrepayment = false,
    shouldPrintAfterSave = false
  ) => {
    if (!form.remark) {
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

    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      return;
    }

    // Prepare purchase data with items - parse formatted values
    const purchaseData = items.map((item) => ({
      ...item,
      item_code: item.sku,
      cost:
        typeof item.cost === "number"
          ? item.cost
          : parseFloat(parseNumberFromFormatted(item.cost || "")) || 0,
      qty:
        typeof item.quantity === "number"
          ? item.quantity
          : parseFloat(parseNumberFromFormatted(item.quantity || "")) || 0,
    }));

    // Aggregate per-line taxes for API (Make Sale–style line tax)
    const taxAmount = calculateTotalTax();
    const taxTotals = new Map();
    items.forEach((item) => {
      if (item.taxable !== "Taxable" || !item.line_tax_id) return;
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

    // Save purchase to stock
    _postApi(
      `/account/purchase-stock`,
      {
        target_department: null,
        target_branch_id: targetBranch || 0,
        data: purchaseData,
        facilityId: activeBusiness._id,
        payable_code: activeBusiness.payable_code,
        supplier_advance: activeBusiness.payable_accural_code,
        user_id: user.id,
        supplier_no: form.supplier_number,
        terms: form.terms,
        remark: form.remark,
        transaction_date: form.date,
        due_date: form.due_date,
        apply_prepayment: usePrepayment,
        tax_amount: taxAmount,
        taxes: taxesArray,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Purchase recorded successfully");
          setLoading(false);
          isSavingRef.current = false;
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
              shouldPrintAfterSave
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
                  printUrl
                );
                navigate(printUrl);
              } else {
                console.error("Purchase response for debugging:", res);
                toast.error(
                  "Unable to generate print page. Invoice reference not found."
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
      }
    );
  };

  const handleDirectPurchase = (printAfterSave = false) => {
    // Hard guard: if a purchase save is already in progress, ignore further clicks
    if (isSavingRef.current || loading) {
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

    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      return;
    }

    // At this point, validation passed; mark saving in progress so
    // buttons cannot be clicked again until the save finishes.
    isSavingRef.current = true;
    setLoading(true);

    // Check supplier balance before saving
    checkSupplierBalance(form.supplier_number, (balance) => {
      // Negative balance means we have advance with supplier (they owe us)
      if (balance < 0 && Math.abs(balance) > 0.01) {
        // There is advance with supplier; show confirmation modal.
        // Since we are not actually saving yet, re-enable buttons so
        // user can interact with the modal actions instead.
        setLoading(false);
        isSavingRef.current = false;
        setSupplierBalance(balance);
        setApplyPrepayment(true); // Automatically check advance
        setShouldPrint(printAfterSave); // Store print flag for modal confirmation
        setShowPrepaymentModal(true);
      } else {
        // No advance, proceed with normal save (loading already true)
        savePurchase(false, printAfterSave);
      }
    });
  };

  const handlePrepaymentConfirm = () => {
    if (isSavingRef.current || loading) {
      return;
    }

    setShowPrepaymentModal(false);
    const printFlag = shouldPrint; // Get the stored print flag
    setShouldPrint(false); // Reset it
    isSavingRef.current = true;
    setLoading(true); // Prevent duplicate clicks while saving
    savePurchase(applyPrepayment, printFlag);
  };

  const handlePrepaymentCancel = () => {
    if (isSavingRef.current || loading) {
      return;
    }

    setShowPrepaymentModal(false);
    setApplyPrepayment(false);
    setShouldPrint(false); // Reset print flag on cancel
    isSavingRef.current = true;
    setLoading(true); // Prevent duplicate clicks while saving
    savePurchase(false, false);
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
      }
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
      }
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
      }
    );
  };

  // Handle opening requisitions drawer
  const handleOpenRequisitionsDrawer = () => {
    setIsRequisitionsDrawerOpen(true);
    fetchApprovedRequisitions();
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
            p.sku === (item.item_code || item.sku) ||
            p.name === item.item_name
        ) || null;

      const taxable =
        matchedProduct?.taxable || item.taxable || "Not Taxable";
      return {
        _id: uuidv4(),
        item_name: item.item_name || "",
        sku: item.item_code || "",
        quantity,
        cost,
        total: parseFloat(quantity) * parseFloat(cost),
        item_type: item.item_type || matchedProduct?.item_type || "",
        taxable,
        line_tax_id: taxable === "Taxable" ? defaultLineTaxId : null,
      };
    });

    // Append items (functional update so multiple PRs can be added in one drawer session)
    setItems((prev) => [...prev, ...requisitionItems]);

    // If supplier info exists on the requisition, set it on the form by default
    // Note: Purchase Requisition stores supplier_number in supplier_code field
    const supplierNo =
      requisition.supplier_number ||
      requisition.supplier_no ||
      requisition.supplier_code;
    if (requisition.supplier_name || supplierNo) {
      setForm((prev) => ({
        ...prev,
        supplier_name: requisition.supplier_name || prev.supplier_name,
        supplier_number: supplierNo || prev.supplier_number,
        supplier_code: requisition.supplier_code || prev.supplier_code,
        supplier_subhead:
          requisition.supplier_subhead ||
          requisition.account_code ||
          prev.supplier_subhead,
      }));
    }

    // Track which PRs were already added (still allow adding other PRs)
    setSelectedRequisitionIds((prev) =>
      prev.includes(requisition.pr_no) ? prev : [...prev, requisition.pr_no]
    );

    toast.success(
      `Added ${requisitionItems.length} item(s) from requisition ${requisition.pr_no}`
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
          s.supplier_code === supplierCode || s.supplier_number === supplierCode
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
    <div className="min-h-screen bg-white font-sans text-[#1c2536]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg border border-[#d7dce6] bg-white text-[#5b6478] transition hover:bg-[#f3f5f9]"
              aria-label="Go back"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a8a]/10 text-[#1e3a8a]">
                <FileText size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#141b2c]">
                  Product Bill
                </h1>
                <p className="text-sm text-[#6b7385]">
                  Record supplier product purchases into warehouse stock
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenRequisitionsDrawer}
            className="flex items-center gap-1.5 text-sm font-medium text-[#2952cc] hover:underline"
          >
            View Purchase Orders
            <ExternalLink size={14} />
          </button>
        </div>

        <div>
          {/* Top fields */}
          <div className="grid grid-cols-1 gap-6 border-b border-[#eceff5] pb-6 sm:grid-cols-2 lg:grid-cols-4">
            <BillField label="Transaction Date">
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleFormChange}
                className="w-full rounded-lg border border-[#d7dce6] bg-white px-3 py-2.5 text-sm text-[#1c2536] outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15"
              />
            </BillField>

            <BillField label="Due Date">
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleFormChange}
                min={form.date}
                className="w-full rounded-lg border border-[#d7dce6] bg-white px-3 py-2.5 text-sm text-[#1c2536] outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15"
              />
            </BillField>

            <BillField label="Warehouse">
              <div className="relative">
                <select
                  value={targetBranch}
                  onChange={(e) =>
                    setTargetBranch(parseInt(e.target.value, 10) || 0)
                  }
                  className="w-full appearance-none rounded-lg border border-[#d7dce6] bg-white px-3 py-2.5 text-sm text-[#1c2536] outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15"
                >
                  <option value={0}>Select warehouse...</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b93a5]"
                />
              </div>
            </BillField>

            <BillField label="Supplier" required>
              <div className="relative">
                <select
                  name="supplier_number"
                  value={form.supplier_number}
                  onChange={(e) => {
                    const selectedSupplier = supplierList.find(
                      (s) => s.supplier_number === e.target.value
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
                  className={`w-full appearance-none rounded-lg border border-[#d7dce6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15 ${
                    !form.supplier_number ? "text-[#9aa1b0]" : "text-[#1c2536]"
                  }`}
                >
                  <option value="">Select supplier...</option>
                  {form.supplier_number &&
                    !supplierList?.some(
                      (s) => s.supplier_number === form.supplier_number
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
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b93a5]"
                />
              </div>
            </BillField>
          </div>

          {/* Payment terms + remark */}
          <div className="grid grid-cols-1 gap-6 border-b border-[#eceff5] py-6 lg:grid-cols-2">
            <BillField label="Payment Terms">
              <CreatableSelect
                className="w-full text-sm"
                classNamePrefix="react-select"
                placeholder="Select or type payment terms"
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
                      setForm((prev) => ({ ...prev, due_date: dueDate }));
                    }
                  }
                }}
                isClearable
                formatCreateLabel={(input) => `Add "${input} days"`}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: 42,
                    borderRadius: 8,
                    borderColor: state.isFocused ? "#2952cc" : "#d7dce6",
                    boxShadow: state.isFocused
                      ? "0 0 0 2px rgba(41,82,204,0.15)"
                      : "none",
                    "&:hover": { borderColor: "#d7dce6" },
                  }),
                }}
              />
            </BillField>

            <BillField label="Remark / Description" required>
              <textarea
                name="remark"
                value={form.remark}
                onChange={handleFormChange}
                placeholder="Enter transaction description..."
                rows={1}
                className="w-full resize-none rounded-lg border border-[#d7dce6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15"
              />
            </BillField>
          </div>

          {/* Item details */}
          <div className="py-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-[#141b2c]">
                ITEM DETAILS
              </h2>
              <span className="text-xs font-medium text-[#8b93a5]">
                VAT:{" "}
                {activeBusiness?.vat_policy === "vat_inclusive"
                  ? "Inclusive"
                  : activeBusiness?.vat_policy === "vat_exclusive"
                  ? "Exclusive"
                  : "All"}
              </span>
            </div>

            <div className="overflow-x-auto border-y border-[#eceff5]">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f6f7fb] text-left text-xs font-semibold uppercase tracking-wide text-[#7b8296]">
                    <th className="w-10 px-3 py-3">#</th>
                    <th className="px-3 py-3">Item Details</th>
                    <th className="w-24 px-3 py-3 text-right">Quantity</th>
                    <th className="w-28 px-3 py-3 text-right">Unit Cost</th>
                    <th className="w-40 px-3 py-3">Tax</th>
                    <th className="w-32 px-3 py-3 text-right">Amount</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const emptyRowCount = Math.max(1, 1 + extraEmptyRows);
                    const rows = [];

                    items.forEach((item, idx) => {
                      const lineVat = getLineTaxAmount(item);
                      rows.push(
                        <tr
                          key={item._id}
                          className="border-t border-[#eceff5] align-top"
                        >
                          <td className="px-3 py-3 text-[#8b93a5]">{idx + 1}</td>
                          <td className="px-3 py-3">
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
                                            item.quantity || ""
                                          )
                                        ) || 0;
                                  const cost = product.cost_price || 0;
                                  const total = qty * cost;
                                  const isTaxable =
                                    (product.taxable || "Taxable") === "Taxable";
                                  const lineTaxId = isTaxable
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
                                            taxable: isTaxable
                                              ? "Taxable"
                                              : "Not Taxable",
                                            line_tax_id: lineTaxId,
                                            cost,
                                            total,
                                          }
                                        : i
                                    )
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
                                        : i
                                    )
                                  );
                                }
                              }}
                              selected={
                                item.item_name && item.sku
                                  ? productList.filter(
                                      (product) =>
                                        product.sku === item.sku &&
                                        product.name === item.item_name
                                    )
                                  : []
                              }
                              clearButton
                              renderMenuItemChildren={(option) => (
                                <div className="flex w-full items-center justify-between py-1">
                                  <span className="text-sm">
                                    {option.name}
                                  </span>
                                  <span className="text-xs text-[#8b93a5]">
                                    {option.sku}
                                  </span>
                                </div>
                              )}
                              inputProps={{
                                className:
                                  "w-full rounded-lg border border-[#d7dce6] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#9aa1b0] focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15",
                              }}
                              positionFixed
                            />
                            {item.sku && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#3d4457]">
                                  <input
                                    type="checkbox"
                                    checked={item.taxable === "Taxable"}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setItems((prev) =>
                                        prev.map((i) => {
                                          if (i._id !== item._id) return i;
                                          if (!checked) {
                                            return {
                                              ...i,
                                              taxable: "Not Taxable",
                                              line_tax_id: null,
                                            };
                                          }
                                          return {
                                            ...i,
                                            taxable: "Taxable",
                                            line_tax_id:
                                              i.line_tax_id || defaultLineTaxId,
                                          };
                                        })
                                      );
                                    }}
                                    className="h-3.5 w-3.5 rounded border-[#d7dce6] text-[#1e3a8a] accent-[#1e3a8a] focus:ring-[#2952cc]/30"
                                  />
                                  Taxable
                                </label>
                                <span className="text-xs text-[#8b93a5]">
                                  {item.sku}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={
                                typeof item.quantity === "number"
                                  ? item.quantity
                                  : parseFloat(
                                      parseNumberFromFormatted(
                                        item.quantity || ""
                                      )
                                    ) || 0
                              }
                              onChange={(e) => {
                                const qty =
                                  parseFloat(e.target.value || "0") || 0;
                                const cost =
                                  typeof item.cost === "number"
                                    ? item.cost
                                    : parseFloat(
                                        parseNumberFromFormatted(
                                          item.cost || ""
                                        )
                                      ) || 0;
                                setItems((prev) =>
                                  prev.map((i) =>
                                    i._id === item._id
                                      ? {
                                          ...i,
                                          quantity: qty,
                                          total: qty * cost,
                                        }
                                      : i
                                  )
                                );
                              }}
                              className="w-full rounded-lg border border-[#d7dce6] bg-white px-2 py-2 text-right text-sm outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={
                                typeof item.cost === "number"
                                  ? item.cost
                                  : parseFloat(
                                      parseNumberFromFormatted(item.cost || "")
                                    ) || 0
                              }
                              onChange={(e) => {
                                const cost =
                                  parseFloat(e.target.value || "0") || 0;
                                const qty =
                                  typeof item.quantity === "number"
                                    ? item.quantity
                                    : parseFloat(
                                        parseNumberFromFormatted(
                                          item.quantity || ""
                                        )
                                      ) || 0;
                                setItems((prev) =>
                                  prev.map((i) =>
                                    i._id === item._id
                                      ? {
                                          ...i,
                                          cost,
                                          total: qty * cost,
                                        }
                                      : i
                                  )
                                );
                              }}
                              className="w-full rounded-lg border border-[#d7dce6] bg-white px-2 py-2 text-right text-sm outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="relative">
                              <select
                                value={item.line_tax_id ?? ""}
                                disabled={item.taxable !== "Taxable"}
                                onChange={(e) => {
                                  const taxId = e.target.value || null;
                                  setItems((prev) =>
                                    prev.map((i) =>
                                      i._id === item._id
                                        ? {
                                            ...i,
                                            line_tax_id: taxId,
                                            taxable: taxId
                                              ? "Taxable"
                                              : "Not Taxable",
                                          }
                                        : i
                                    )
                                  );
                                }}
                                className="w-full appearance-none rounded-lg border border-[#d7dce6] bg-white px-3 py-2 text-sm outline-none focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15 disabled:bg-[#f6f7fb]"
                              >
                                <option value="">Select a Tax</option>
                                {lineTaxOptions.map((tax) => (
                                  <option key={tax.id} value={tax.id}>
                                    {tax.description} ({tax.rate}%)
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={14}
                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b93a5]"
                              />
                            </div>
                            {item.taxable === "Taxable" && lineVat > 0 && (
                              <div className="mt-1 text-[11px] tabular-nums text-[#8b93a5]">
                                ₦{formatNumber(lineVat)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">
                            {formatNumber(item.total)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item._id)}
                              className="rounded-md p-1.5 text-[#b5bac7] transition hover:bg-red-50 hover:text-red-500"
                              aria-label="Remove row"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    });

                    for (let i = 0; i < emptyRowCount; i++) {
                      rows.push(
                        <tr
                          key={`empty-bill-row-${i}`}
                          className="border-t border-[#eceff5] align-top"
                        >
                          <td className="px-3 py-3 text-[#8b93a5]">
                            {items.length + i + 1}
                          </td>
                          <td className="px-3 py-3">
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
                                  <span className="text-xs text-[#8b93a5]">
                                    ₦{formatNumber(option.cost_price || 0)}
                                  </span>
                                </div>
                              )}
                              inputProps={{
                                className:
                                  "w-full rounded-lg border border-[#d7dce6] bg-white px-3 py-2 text-sm outline-none placeholder:text-[#9aa1b0] focus:border-[#2952cc] focus:ring-2 focus:ring-[#2952cc]/15",
                              }}
                              positionFixed
                            />
                          </td>
                          <td className="px-3 py-3 text-right text-[#9aa1b0]">
                            1.00
                          </td>
                          <td className="px-3 py-3 text-right text-[#9aa1b0]">
                            0.00
                          </td>
                          <td className="px-3 py-3">
                            <div className="relative">
                              <select
                                disabled
                                className="w-full appearance-none rounded-lg border border-[#d7dce6] bg-[#f6f7fb] px-3 py-2 text-sm text-[#9aa1b0]"
                                defaultValue=""
                              >
                                <option value="">Select a Tax</option>
                              </select>
                              <ChevronDown
                                size={14}
                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b93a5]"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right text-[#9aa1b0]">
                            0.00
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (emptyRowCount <= 1) return;
                                setExtraEmptyRows((n) => n - 1);
                              }}
                              disabled={emptyRowCount <= 1}
                              className="rounded-md p-1.5 text-[#b5bac7] transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                              aria-label="Remove empty row"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    return rows;
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#eceff5]">
                    <td colSpan={4} />
                    <td className="px-3 py-3 text-right text-sm font-medium text-[#5b6478]">
                      Sub Total
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-[#1c2536]">
                      {formatNumber(calculateTotal())}
                    </td>
                    <td />
                  </tr>
                  {selectedTaxes.length > 0 &&
                    calculateTotalTax() > 0 &&
                    selectedTaxes.map((tax) => {
                      const taxAmountForDisplay = items.reduce((sum, item) => {
                        if (
                          item.taxable !== "Taxable" ||
                          String(item.line_tax_id) !== String(tax.id)
                        ) {
                          return sum;
                        }
                        return (
                          sum +
                          calculateTaxAmount(parseFloat(item.total || 0), tax)
                        );
                      }, 0);
                      return (
                        <tr key={tax.id} className="border-t border-[#eceff5]">
                          <td colSpan={4} />
                          <td className="px-3 py-3 text-right text-sm font-medium text-[#5b6478]">
                            {tax.description} ({tax.rate}%)
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-[#1c2536]">
                            {formatNumber(taxAmountForDisplay)}
                          </td>
                          <td />
                        </tr>
                      );
                    })}
                  <tr className="border-t border-[#eceff5] bg-[#f6f7fb]">
                    <td colSpan={4} />
                    <td className="px-3 py-3.5 text-right text-base font-bold text-[#141b2c]">
                      Total (NGN)
                    </td>
                    <td className="px-3 py-3.5 text-right text-lg font-bold tabular-nums text-[#141b2c]">
                      {formatNumber(getTotalWithTax())}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExtraEmptyRows((n) => n + 1)}
                className="flex items-center gap-1.5 rounded-lg border border-[#d7dce6] px-3.5 py-2 text-sm font-medium text-[#2952cc] transition hover:bg-[#f3f5f9]"
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
                  className="rounded-lg border border-[#d7dce6] px-3.5 py-2 text-sm font-medium text-[#5b6478] transition hover:bg-[#f3f5f9]"
                >
                  Clear all lines
                </button>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 border-t border-[#eceff5] py-4">
            <div className="text-sm text-[#6b7385]">
              {items.length} item{items.length === 1 ? "" : "s"} · Total ₦
              {formatNumber(getTotalWithTax())}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={loading}
                className="rounded-lg border border-[#d7dce6] px-4 py-2.5 text-sm font-medium text-[#5b6478] transition hover:bg-[#f3f5f9] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDirectPurchase(true)}
                disabled={loading || items.length === 0}
                className="rounded-lg border border-[#d7dce6] px-4 py-2.5 text-sm font-medium text-[#5b6478] transition hover:bg-[#f3f5f9] disabled:opacity-50"
              >
                Save and print
              </button>
              <button
                type="button"
                onClick={() => handleDirectPurchase(false)}
                disabled={loading || items.length === 0}
                className="rounded-lg bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#182f70] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Save Bill"
                )}
              </button>
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
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-[var(--aa-sidebar-active)] text-[#4267B2]">
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
                <Loader className="h-5 w-5 animate-spin text-[#4267B2]" />
                <span className="ml-2 text-sm text-slate-500">
                  Loading requisitions...
                </span>
              </div>
            ) : requisitions.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--aa-sidebar-active)] text-[#4267B2]">
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
                  .map((requisition) => (
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
                                            {item.item_name}{" "}
                                            {item.unit_measure}
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
                              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-[#4267B2] transition hover:bg-[var(--aa-sidebar-active)] disabled:cursor-not-allowed disabled:opacity-50"
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
                              className="flex-1 rounded-md border-0 bg-[#4267B2] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#4267B2]/90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Add &amp; Close
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
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
                className="rounded-md border-0 bg-[#4267B2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4267B2]/90"
              >
                Done
              </button>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Advance Confirmation Modal */}
      {showPrepaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 z-50 animate-in fade-in duration-200">
          <div className="bg-white max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 transform transition-all animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-[var(--aa-accent)]" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Supplier Advance Available
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      You must apply this advance to the transaction
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrepaymentModal(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Warning Banner */}
              <div className="border-l-4 border-amber-500 pl-3 py-1">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">
                      Mandatory Advance Application
                    </p>
                    <p className="text-sm text-amber-800">
                      You have an available advance balance with this supplier.
                      This advance{" "}
                      <strong className="font-bold">must be applied</strong> to
                      this transaction.
                    </p>
                  </div>
                </div>
              </div>

              {/* Amounts */}
              <div className="space-y-3 border-t border-b border-slate-200 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[var(--aa-accent)]" />
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Available Advance
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-[var(--aa-accent)]">
                    ₦{formatNumber(Math.abs(supplierBalance))}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-slate-700" />
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Transaction Amount
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    ₦{formatNumber(getTotalWithTax())}
                  </p>
                </div>
              </div>

              {/* Advance Status */}
              <div className="flex items-center gap-3 py-2 border-b border-slate-200">
                <Check className="w-5 h-5 text-[var(--aa-accent)]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    Advance Application Status
                  </p>
                  <p className="text-sm text-slate-600 mt-1">
                    Advance will be automatically applied to this transaction
                  </p>
                </div>
                <span className="text-xs font-bold text-[var(--aa-accent)]">
                  REQUIRED
                </span>
              </div>

              {/* Remaining Payable & Remaining Advance */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                    Still Payable
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    ₦
                    {formatNumber(
                      Math.max(0, getTotalWithTax() - Math.abs(supplierBalance))
                    )}
                  </p>
                  {Math.abs(supplierBalance) >= getTotalWithTax() && (
                    <p className="text-xs text-[var(--aa-accent)] mt-1 font-medium">
                      Fully covered
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                    Advance Remaining
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    ₦
                    {formatNumber(
                      Math.max(0, Math.abs(supplierBalance) - getTotalWithTax())
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    after this bill
                  </p>
                </div>
              </div>

              {/* Accounting Treatment (collapsible) */}
              {(() => {
                const settleAmount = Math.min(getTotalWithTax(), Math.abs(supplierBalance));
                const stillPayable = Math.max(0, getTotalWithTax() - Math.abs(supplierBalance));
                return (
                  <div className="border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowAdvanceAccounting((v) => !v)}
                      className="w-full flex items-center justify-between px-0 py-2.5 hover:bg-slate-50 transition-colors text-sm font-semibold text-gray-700"
                    >
                      <span className="flex items-center gap-2">
                        Accounting Treatment
                      </span>
                      <span className="text-gray-400 text-xs">{showAdvanceAccounting ? "▲ Hide" : "▼ Show"}</span>
                    </button>
                    {showAdvanceAccounting && (
                      <div className="px-4 py-3 bg-white space-y-1.5 text-xs">
                        <p className="text-gray-500 mb-2">Journal entries that will be posted when you confirm:</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50 text-gray-600 uppercase tracking-wide">
                                <th className="text-left px-3 py-2 border border-gray-200">Account</th>
                                <th className="text-right px-3 py-2 border border-gray-200">Dr (₦)</th>
                                <th className="text-right px-3 py-2 border border-gray-200">Cr (₦)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              <tr className="hover:bg-gray-50">
                                <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800">
                                  Purchases / Inventory (Expense)
                                </td>
                                <td className="px-3 py-2 border border-gray-200 text-right font-semibold text-gray-800">
                                  {formatNumber(settleAmount)}
                                </td>
                                <td className="px-3 py-2 border border-gray-200 text-right text-gray-400">—</td>
                              </tr>
                              <tr className="hover:bg-gray-50">
                                <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800">
                                  Advance to Suppliers Account
                                </td>
                                <td className="px-3 py-2 border border-gray-200 text-right text-gray-400">—</td>
                                <td className="px-3 py-2 border border-gray-200 text-right font-semibold text-gray-800">
                                  {formatNumber(settleAmount)}
                                </td>
                              </tr>
                              {stillPayable > 0 && (
                                <tr className="bg-amber-50">
                                  <td className="px-3 py-2 border border-gray-200 font-medium text-amber-800" colSpan={3}>
                                    ⚠ Remaining ₦{formatNumber(stillPayable)} stays open as payable — pay via Pay Bills
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={handlePrepaymentCancel}
                className="px-5 py-2.5 text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handlePrepaymentConfirm}
                disabled={loading}
                className="px-6 py-2.5 text-sm bg-[var(--aa-accent)] hover:bg-[var(--aa-accent-hover)] text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Continue with Advance
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function BillField({ label, required, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#3d4457]">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
