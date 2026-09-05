/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  FileText,
  X,
  Loader,
  Users,
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
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { getSuppliers } from "@/redux/actions/suppliers";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import useQuery from "@/hooks/useQuery";
import { Button } from "@/components/ui/button";
import CreatableSelect from "react-select/creatable";
import { Typeahead } from "react-bootstrap-typeahead";
import CreateImprestDrawer from "@/components/common/CreateImprestDrawer";
import CashTransferPaymentFields, {
  buildPaymentSplits,
  isCashTransferSplitMode,
  parseMoneyInput,
} from "@/components/common/CashTransferPaymentFields";
import { isProductTaxable } from "@/utils/taxableStatus";

const initialItemForm = {
  item_name: "",
  sku: "",
  quantity: "",
  cost: "",
  total: 0,
  item_type: "",
  taxable: "Non-Taxable",
  line_tax_id: null,
};

export default function OperatingExpenses() {
  const query = useQuery();
  const expenseSelectRef = useRef();
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
    mode_of_payment: "", // cash | bank | cheque (when payment_type === cash)
    mod_account_code: "",
    cheque_number: "",
  });

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(initialItemForm);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [productList, setProductList] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [headList, setHeadList] = useState([]);
  const [bankAccount, setBankAccount] = useState({});
  const [accountHead, setAccountHead] = useState({});
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const cashAccountTypeaheadRef = useRef();
  const hasAutoSelectedSupplier = useRef(false);
  const isCashPayment = form.payment_type === "cash";
  const isSplitPayment = isCashTransferSplitMode(form.mode_of_payment);


  // Tax-related state
  const [taxes, setTaxes] = useState([]);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";

  // Editing state
  const [editingItem, setEditingItem] = useState(null);
  const [extraEmptyRows, setExtraEmptyRows] = useState(0);

  // Expenses memo drawer state
  const [isMemoDrawerOpen, setIsMemoDrawerOpen] = useState(false);
  const [memos, setMemos] = useState([]);
  const [loadingMemos, setLoadingMemos] = useState(false);
  const [selectedMemoIds, setSelectedMemoIds] = useState([]);
  const [closingMemoId, setClosingMemoId] = useState(null);
  const [showCloseMemoModal, setShowCloseMemoModal] = useState(false);
  const [memoToClose, setMemoToClose] = useState(null);
  const [memosToClose, setMemosToClose] = useState([]);

  const [imprestOpen, setImprestOpen] = useState(false);
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

  // Format number with commas for display
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

  // Parse formatted number (remove commas)
  const parseNumberFromFormatted = (value) => {
    if (!value || value === "") return "";
    // Convert to string first to handle both string and number inputs
    const stringValue = String(value);
    // Remove commas and keep only numbers and decimal point
    return stringValue.replace(/,/g, "");
  };

  // Handle numeric input (allow numbers, dots, and commas)
  const handleNumericInput = (value) => {
    return value.replace(/[^0-9.,]/g, "");
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    let updatedItem = { ...currentItem };

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
      const qtyParsed = parseNumberFromFormatted(
        name === "quantity" ? formattedValue : updatedItem.quantity || "",
      );
      const costParsed = parseNumberFromFormatted(
        name === "cost" ? formattedValue : updatedItem.cost || "",
      );

      const qty = qtyParsed === "" ? 0 : parseFloat(qtyParsed) || 0;
      const cost = costParsed === "" ? 0 : parseFloat(costParsed) || 0;
      updatedItem.total = qty * cost;
    } else {
      updatedItem[name] = value;
    }

    setCurrentItem(updatedItem);
  };

  const addItem = () => {
    console.log(currentItem, "=====================>currentItem");
    if (
      !currentItem.item_name ||
      !currentItem.quantity ||
      !currentItem.cost ||
      !currentItem.description
    ) {
      toast.error("Please fill in all item fields");
      return;
    }

    // Parse formatted values before calculating total
    const qtyParsed = parseNumberFromFormatted(currentItem.quantity || "");
    const costParsed = parseNumberFromFormatted(currentItem.cost || "");
    const qty = qtyParsed === "" ? 0 : parseFloat(qtyParsed) || 0;
    const cost = costParsed === "" ? 0 : parseFloat(costParsed) || 0;

    const newItem = {
      ...currentItem,
      _id: uuidv4(),
      total: qty * cost,
    };

    setItems([...items, newItem]);
    setCurrentItem(initialItemForm);

    // Clear the select
    if (expenseSelectRef.current) {
      expenseSelectRef.current.setValue(null);
    }

    toast.success("Item added");
  };

  const addExpenseRow = (expense) => {
    if (!expense?.name || !expense?.code) {
      toast.error("Please select an expense account");
      return;
    }
    const newItem = {
      _id: uuidv4(),
      item_name: expense.name || "",
      head: expense.code || "",
      account_type: expense.account_type || "",
      description: expense.name || "",
      quantity: "1",
      cost: "",
      total: 0,
      taxable: "Non-Taxable",
      line_tax_id: null,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const updateItemField = (id, patch) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i._id !== id) return i;
        const next = { ...i, ...patch };
        const qty =
          parseFloat(parseNumberFromFormatted(String(next.quantity || ""))) ||
          0;
        const cost =
          parseFloat(parseNumberFromFormatted(String(next.cost || ""))) || 0;
        next.total = qty * cost;
        return next;
      }),
    );
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
      !currentItem.description
    ) {
      toast.error("Please fill in all item fields");
      return;
    }

    // Parse formatted values before calculating total
    const qtyParsed = parseNumberFromFormatted(currentItem.quantity || "");
    const costParsed = parseNumberFromFormatted(currentItem.cost || "");
    const qty = qtyParsed === "" ? 0 : parseFloat(qtyParsed) || 0;
    const cost = costParsed === "" ? 0 : parseFloat(costParsed) || 0;

    setItems(
      items.map((item) =>
        item._id === editingItem
          ? {
              ...currentItem,
              total: qty * cost,
            }
          : item,
      ),
    );

    setEditingItem(null);
    setCurrentItem(initialItemForm);

    // Clear the select
    if (expenseSelectRef.current) {
      expenseSelectRef.current.setValue(null);
    }

    toast.success("Item updated");
  };

  // Function to cancel editing
  const cancelEditing = () => {
    setEditingItem(null);
    setCurrentItem(initialItemForm);

    // Clear the select
    if (expenseSelectRef.current) {
      expenseSelectRef.current.setValue(null);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      // Parse formatted values if needed
      const totalParsed = parseNumberFromFormatted(
        item.total?.toString() || "",
      );
      const total = totalParsed === "" ? 0 : parseFloat(totalParsed) || 0;
      return sum + total;
    }, 0);
  };

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

  // Filter taxes based on vat_policy (same as New Product Bill)
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
    const totalParsed = parseNumberFromFormatted(item.total?.toString() || "");
    const base = totalParsed === "" ? 0 : parseFloat(totalParsed) || 0;
    return calculateTaxAmount(base, tax);
  };

  // Keep selectedTaxes in sync with per-line tax picks (New Product Bill pattern)
  useEffect(() => {
    const usedIds = new Set(
      items
        .filter((i) => isProductTaxable(i.taxable) && i.line_tax_id)
        .map((i) => String(i.line_tax_id)),
    );
    setSelectedTaxes(lineTaxOptions.filter((t) => usedIds.has(String(t.id))));
  }, [items, lineTaxOptions]);

  // Per-line tax total
  const calculateTotalTax = () => {
    return items.reduce((sum, item) => sum + getLineTaxAmount(item), 0);
  };

  // Grand total: subtotal + exclusive line tax only (inclusive already in cost)
  const getTotal = () => {
    const subtotal = calculateTotal();
    let exclusiveVAT = 0;
    items.forEach((item) => {
      if (!isProductTaxable(item.taxable)) return;
      const tax = getLineTax(item);
      if (!tax || isTaxInclusive(tax)) return;
      exclusiveVAT += getLineTaxAmount(item);
    });
    return subtotal + exclusiveVAT;
  };

  // Actual save function
  const savePurchase = (
    usePrepayment = false,
    shouldPrintAfterSave = false,
  ) => {
    if (!form.remark) {
      toast.error("Please input remark");
      setLoading(false);
      isSavingRef.current = false;
      return;
    }

    if (!form.supplier_number) {
      toast.error("Please select a supplier");
      setLoading(false);
      isSavingRef.current = false;
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      setLoading(false);
      isSavingRef.current = false;
      return;
    }

    // Validate that all items have Account Description selected
    const itemsWithoutAccountDescription = items.filter(
      (item) => !item.item_name || !item.head,
    );
    if (itemsWithoutAccountDescription.length > 0) {
      toast.error(
        `Please select Account Description for all items. ${itemsWithoutAccountDescription.length} item(s) missing Account Description.`,
      );
      setLoading(false);
      isSavingRef.current = false;
      return;
    }

    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      setLoading(false);
      isSavingRef.current = false;
      return;
    }

    if (isCashPayment) {
      if (!form.mode_of_payment) {
        toast.error("Please select mode of payment");
        setLoading(false);
        isSavingRef.current = false;
        return;
      }
      if (isSplitPayment) {
        const cash = parseMoneyInput(cashAmount);
        const transfer = parseMoneyInput(transferAmount);
        const billTotal = getTotal();
        if (cash <= 0 || transfer <= 0) {
          toast.error("Enter both cash and transfer amounts");
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
        if (Math.abs(cash + transfer - billTotal) > 0.02) {
          toast.error(
            `Cash + Transfer must equal bill total (₦${billTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})`,
          );
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
        if (!accountHead?.head) {
          toast.error("Please select a cash account");
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
        if (!bankAccount?.id) {
          toast.error("Please select a bank account");
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
      } else {
        if (form.mode_of_payment === "cash" && !accountHead?.head) {
          toast.error("Please select a cash account");
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
        if (
          ["bank", "cheque"].includes(form.mode_of_payment) &&
          !bankAccount?.id
        ) {
          toast.error("Please select a bank account");
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
        if (form.mode_of_payment === "cheque" && !form.cheque_number) {
          toast.error("Please enter a cheque number");
          setLoading(false);
          isSavingRef.current = false;
          return;
        }
      }
    }

    // Aggregate per-line taxes for API (New Product Bill pattern)
    const taxAmount = calculateTotalTax();
    const taxTotals = new Map();
    items.forEach((item) => {
      if (!isProductTaxable(item.taxable) || !item.line_tax_id) return;
      const tax = getLineTax(item);
      if (!tax) return;
      const totalParsed = parseNumberFromFormatted(
        item.total?.toString() || "",
      );
      const base = totalParsed === "" ? 0 : parseFloat(totalParsed) || 0;
      const amount = calculateTaxAmount(base, tax);
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
          inclusive_type: isTaxInclusive(tax) ? "inclusive" : "exclusive",
        });
      }
    });
    const taxesArray = Array.from(taxTotals.values());

    // Prepare purchase data with items
    const purchaseData = items.map((item) => {
      // Parse formatted values before sending to API
      const costParsed = parseNumberFromFormatted(item.cost || "");
      const qtyParsed = parseNumberFromFormatted(item.quantity || "");
      const cost = costParsed === "" ? 0 : parseFloat(costParsed) || 0;
      const qty = qtyParsed === "" ? 0 : parseFloat(qtyParsed) || 0;

      return {
        head: item.head,
        account_head: item.head,
        description: item.description || item.item_name,
        cost: cost,
        quantity: qty,
        qty: qty,
        taxable: item.taxable || "Non-Taxable",
        line_tax_id: item.line_tax_id || null,
      };
    });

    // Credit → A/P (purchase-expenses). Cash/bank/cheque → cash/bank CR (same endpoint with mode).
    _postApi(
      `/account/purchase-expenses`,
      {
        data: purchaseData,
        facilityId: activeBusiness.id || activeBusiness._id,
        payable_code: activeBusiness.payable_code,
        payable_accrual_code:
          activeBusiness.payable_accural_code ||
          activeBusiness.payable_accrual_code,
        user_id: user.id,
        supplier_no: form.supplier_number,
        terms: isCashPayment ? "0" : form.terms || "30",
        remark: form.remark || "",
        transaction_date: form.date,
        due_date: isCashPayment ? form.date : form.due_date,
        apply_prepayment: isCashPayment ? false : usePrepayment,
        tax_amount: taxAmount,
        taxes: taxesArray,
        mode_of_payment: isCashPayment ? form.mode_of_payment : "credit",
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
          // Close memos treated on this bill (Add to List / remaining unclosed)
          const idsToClose = [
            ...new Set([...(selectedMemoIds || []), ...(memosToClose || [])]),
          ];
          if (idsToClose.length > 0) {
            idsToClose.forEach((memoId) => {
              const memo = memos.find((m) => m.memo_id === memoId) || {
                memo_id: memoId,
              };
              closeMemoStatus(memo, { addItems: false });
            });
            setMemosToClose([]);
            setSelectedMemoIds([]);
          }
          // Create ledger entries
          toast.success(
            res.message || "Expense purchase recorded successfully",
          );
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

            if (invoiceRef) {
              navigate(
                `/app/expenses/billing/operating-expense-bill-pdf?invoice_ref=${invoiceRef}`,
              );
            } else {
              // If no invoice_ref, try to navigate with transaction_ref or other identifier
              const transactionRef =
                res.data?.transaction_ref ||
                res.transaction_ref ||
                res.data?.id ||
                res.id;
              if (transactionRef) {
                navigate(
                  `/app/expenses/billing/operating-expense-bill-pdf?invoice_ref=${transactionRef}`,
                );
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
          toast.error(res.message || "Failed to save expense purchase");
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
    // Hard guard: if a save is already in progress, ignore further clicks
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

    // Validate that all items have Account Description selected
    const itemsWithoutAccountDescription = items.filter(
      (item) => !item.item_name || !item.head,
    );
    if (itemsWithoutAccountDescription.length > 0) {
      toast.error(
        `Please select Account Description for all items. ${itemsWithoutAccountDescription.length} item(s) missing Account Description.`,
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

    // Cash bills are paid immediately — no advance flow.
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

  const getExpenseList = () => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          setExpenseList(
            resp.results
              // .filter((item) => item.show === 1)
              .map((item) => ({
                name: item.description,
                code: item.head,
                chart_code: item.subhead,
                account_type: item.account_type || "",
                show: item.show || "",
              })),
          );
        } else {
          toast.error("Failed to load list of items.");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
      },
    );
  };

  // Fetch taxes for purchase/expenses
  const getTaxes = () => {
    if (!activeBusiness?.id) return;

    setLoadingTaxes(true);
    const taxCategory = encodeURIComponent("purchase");
    _fetchApi(
      `/api/get-taxes-by-category?facilityId=${activeBusiness.id}&tax_category=${taxCategory}`,
      (response) => {
        if (response.success) {
          setTaxes(response.results || []);
        }
        setLoadingTaxes(false);
      },
      (err) => {
        console.error("Error fetching taxes:", err);
        setLoadingTaxes(false);
      },
    );
  };

  // Fetch memos for the expenses memo drawer (with items included)
  const fetchMemos = () => {
    if (!activeBusiness?.id) return;

    setLoadingMemos(true);
    _fetchApi(
      `/account/get-reviewed-memos-with-items/${activeBusiness.id}/${user.id}`,
      (data) => {
        setLoadingMemos(false);
        if (data.success) {
          // Memos now include items array, item_count, and total_item_cost
          setMemos(data.results);
        } else {
          toast.error("Failed to fetch memos");
          setMemos([]);
        }
      },
      (err) => {
        setLoadingMemos(false);
        console.error("Error fetching memos:", err);
        toast.error("Error fetching memos");
        setMemos([]);
      },
    );
  };

  // Handle opening memo drawer
  const handleOpenMemoDrawer = () => {
    setIsMemoDrawerOpen(true);
    fetchMemos();
  };

  // Add memo items to the current items list
  // Items are now already included in the memo object from the API
  const addMemoItems = (memo) => {
    if (selectedMemoIds.includes(memo.memo_id)) {
      toast.info(`Memo ${memo.memo_id} is already on this bill`);
      return false;
    }

    // Check if memo has items
    if (!memo.items || memo.items.length === 0) {
      toast.error("No items found in this memo");
      return false;
    }

    // Map the items from the memo to the format expected by the items list
    const memoItems = memo.items.map((item) => ({
      _id: uuidv4(),
      item_name: "",
      head: "",
      description: item.description || item.item_name || "",
      sku: item.item_code || item.sku || "",
      quantity: item.quantity || 1,
      cost: item.unit_cost || item.cost || item.amount || 0,
      total:
        parseFloat(item.quantity || 1) *
        parseFloat(item.unit_cost || item.cost || item.amount || 0),
      item_type: item.item_subhead || item.item_type || "",
      taxable: item.taxable || "Non-Taxable",
      line_tax_id: null,
    }));

    // Functional update so multiple memos can be added without losing prior lines
    setItems((prev) => [...prev, ...memoItems]);

    // Populate Select Supplier when memo has supplier details
    if (memo.supplier_number || memo.supplier_name) {
      setForm((prev) => ({
        ...prev,
        supplier_name: memo.supplier_name || prev.supplier_name,
        supplier_code: memo.supplier_code || prev.supplier_code,
        supplier_number: memo.supplier_number || prev.supplier_number,
        supplier_subhead:
          memo.account_code || memo.supplier_subhead || prev.supplier_subhead,
      }));
    }

    setSelectedMemoIds((prev) =>
      prev.includes(memo.memo_id) ? prev : [...prev, memo.memo_id],
    );

    toast.success(
      `Added ${memoItems.length} item(s) from memo ${memo.memo_id}`,
    );
    return true;
  };

  // Close memo (update status to "closed") — removed from this drawer list when successful
  const closeMemoStatus = (memo, { addItems } = { addItems: false }) => {
    if (!activeBusiness?.id && !activeBusiness?._id) {
      toast.error("Active business not found");
      return;
    }

    // Optionally add items before closing
    if (addItems) {
      const added = addMemoItems(memo);
      if (!added && !selectedMemoIds.includes(memo.memo_id)) {
        return;
      }
    }

    setClosingMemoId(memo.memo_id);
    _postApi(
      "/account/close-memo",
      {
        memo_id: memo.memo_id,
        facilityId: activeBusiness.id || activeBusiness._id,
        user_id: user.id,
      },
      (resp) => {
        setClosingMemoId(null);
        if (resp.success) {
          toast.success(resp.message || "Memo closed successfully");
          // Drop from drawer list immediately (treated memos must not reappear)
          setMemos((prev) => prev.filter((m) => m.memo_id !== memo.memo_id));
          setMemosToClose((prev) => prev.filter((id) => id !== memo.memo_id));
          // Already closed — don't queue again on bill save
          setSelectedMemoIds((prev) =>
            prev.filter((id) => id !== memo.memo_id),
          );
        } else {
          toast.error(resp.message || "Failed to close memo");
        }
      },
      (err) => {
        setClosingMemoId(null);
        console.error("Error closing memo:", err);
        toast.error(err.message || "Failed to close memo");
      },
    );
  };

  useEffect(() => {
    dispatch(getSuppliers());
    getProducts();
    getExpenseList();
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

  useEffect(() => {
    setBankAccount({});
    setAccountHead({});
    setAccountList([]);
    setHeadList([]);

    if (!isCashPayment || !activeBusiness?.id) return;

    const needCash =
      form.mode_of_payment === "cash" ||
      isCashTransferSplitMode(form.mode_of_payment);
    const needBank =
      form.mode_of_payment === "cheque" ||
      form.mode_of_payment === "bank" ||
      isCashTransferSplitMode(form.mode_of_payment);

    if (needCash) {
      _postApi(
        `/inventory/product-list?query_type=cash`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) {
            setHeadList(resp?.results || []);
          } else {
            toast.error("Failed to load cash accounts.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Something went wrong while fetching cash accounts.");
        },
      );
    }
    if (needBank) {
      _fetchApi(
        `/api/get/bank-accounts?facilityId=${activeBusiness.id}`,
        (data) => {
          if (data.success) {
            setAccountList(data.results || []);
          } else {
            toast.error("Failed to load bank accounts");
          }
        },
        (err) => {
          console.error(err);
          toast.error("Failed to load bank accounts");
        },
      );
    }
  }, [form.mode_of_payment, form.payment_type, activeBusiness?.id]);


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
              Please wait while we record your expense
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col bg-white">
        <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText
                className="size-6 text-[var(--aa-accent)]"
                strokeWidth={1.75}
              />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Expenses Bill
                </h1>
                <p className="text-xs text-slate-500">
                  Record supplier operating expenses (credit or cash)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenMemoDrawer}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--aa-navy,#0f2744)] hover:underline"
            >
              View Expenses Memos
            </button>
          </div>
          {(!form.supplier_number ||
            !String(form.remark || "").trim() ||
            items.length === 0) && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {!form.supplier_number && (
                <span className="mr-3">Select a supplier.</span>
              )}
              {!String(form.remark || "").trim() && (
                <span className="mr-3">Enter a remark / description.</span>
              )}
              {items.length === 0 && (
                <span className="mr-3">Add at least one expense line.</span>
              )}
            </div>
          )}
        </div>

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
                Instant Payment
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
              expectedTotal={getTotal()}
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

        {/* Item Table — invoice style */}
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
                  <th className="min-w-[260px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                    Expense Account
                  </th>
                  <th className="min-w-[200px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                    Description
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
                    rows.push(
                      <tr
                        key={item._id}
                        className="bg-white hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3 align-top">
                          <Typeahead
                            id={`expense-row-typeahead-${item._id}`}
                            labelKey={(option) =>
                              `${option.name || ""} (${option.code || ""})`
                            }
                            options={expenseList}
                            placeholder="Select expense account"
                            onChange={(selectedItems) => {
                              if (selectedItems?.length) {
                                const expense = selectedItems[0];
                                updateItemField(item._id, {
                                  item_name: expense.name || "",
                                  head: expense.code || "",
                                  account_type: expense.account_type || "",
                                  description:
                                    item.description || expense.name || "",
                                });
                              } else {
                                updateItemField(item._id, {
                                  item_name: "",
                                  head: "",
                                  account_type: "",
                                });
                              }
                            }}
                            selected={
                              item.item_name && item.head
                                ? expenseList.filter(
                                    (expense) =>
                                      expense.code === item.head &&
                                      expense.name === item.item_name,
                                  )
                                : []
                            }
                            clearButton
                            allowNew={false}
                            renderMenuItemChildren={(option) => (
                              <div className="flex w-full items-center justify-between py-1">
                                <span className="text-sm">{option.name}</span>
                                <span className="text-xs text-slate-500">
                                  {option.code}
                                </span>
                              </div>
                            )}
                            inputProps={{
                              className:
                                "w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]",
                            }}
                            positionFixed
                          />
                          {item.head && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <button
                                type="button"
                                title="Click to toggle taxable"
                                onClick={() => {
                                  if (isProductTaxable(item.taxable)) {
                                    updateItemField(item._id, {
                                      taxable: "Non-Taxable",
                                      line_tax_id: null,
                                    });
                                  } else {
                                    updateItemField(item._id, {
                                      taxable: "Taxable",
                                      line_tax_id:
                                        item.line_tax_id || defaultLineTaxId,
                                    });
                                  }
                                }}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  isProductTaxable(item.taxable)
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {isProductTaxable(item.taxable)
                                  ? "Taxable"
                                  : "Not taxable"}
                              </button>
                              <span className="text-[11px] text-slate-500">
                                Code: {item.head}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <input
                            type="text"
                            value={item.description || ""}
                            placeholder="Enter description..."
                            onChange={(e) =>
                              updateItemField(item._id, {
                                description: e.target.value,
                              })
                            }
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          />
                        </td>
                        <td className="min-w-[8.5rem] w-36 px-3 py-3 text-right align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            value={item.quantity || ""}
                            onChange={(e) => {
                              const withoutCommas = e.target.value.replace(
                                /,/g,
                                "",
                              );
                              const sanitized =
                                handleNumericInput(withoutCommas);
                              const parts = sanitized.split(".");
                              const numericValue =
                                parts.length > 2
                                  ? parts[0] + "." + parts.slice(1).join("")
                                  : sanitized;
                              updateItemField(item._id, {
                                quantity: formatNumberWithCommas(numericValue),
                              });
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
                            value={item.cost || ""}
                            onChange={(e) => {
                              const withoutCommas = e.target.value.replace(
                                /,/g,
                                "",
                              );
                              const sanitized =
                                handleNumericInput(withoutCommas);
                              const parts = sanitized.split(".");
                              const numericValue =
                                parts.length > 2
                                  ? parts[0] + "." + parts.slice(1).join("")
                                  : sanitized;
                              updateItemField(item._id, {
                                cost: formatNumberWithCommas(numericValue),
                              });
                            }}
                            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <select
                            value={item.line_tax_id ?? ""}
                            disabled={!isProductTaxable(item.taxable)}
                            onChange={(e) => {
                              const taxId = e.target.value || null;
                              updateItemField(item._id, {
                                line_tax_id: taxId,
                                taxable: taxId ? "Taxable" : "Non-Taxable",
                              });
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
                          {isProductTaxable(item.taxable) &&
                            getLineTaxAmount(item) > 0 && (
                              <div className="mt-1 text-[11px] tabular-nums text-slate-500">
                                ₦{formatNumber(getLineTaxAmount(item))}
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
                        key={`empty-expense-row-${i}`}
                        className="bg-white hover:bg-slate-50/80"
                      >
                        <td className="px-3 py-3 align-top">
                          <Typeahead
                            key={`empty-expense-${i}-${items.length}`}
                            id={`empty-expense-typeahead-${i}`}
                            labelKey={(option) =>
                              `${option.name || ""} (${option.code || ""})`
                            }
                            options={expenseList}
                            placeholder="Select expense account"
                            onChange={(selected) => {
                              if (selected?.length) {
                                addExpenseRow(selected[0]);
                                setExtraEmptyRows((n) => n - 1);
                              }
                            }}
                            selected={[]}
                            renderMenuItemChildren={(option) => (
                              <div className="flex w-full items-center justify-between py-1">
                                <span className="text-sm">{option.name}</span>
                                <span className="text-xs text-slate-500">
                                  {option.code}
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
                        <td className="px-3 py-3 align-top text-sm text-slate-400">
                          —
                        </td>
                        <td className="min-w-[8.5rem] w-36 px-3 py-3 text-right align-top text-sm text-slate-400">
                          1.00
                        </td>
                        <td className="min-w-[10rem] w-44 px-3 py-3 text-right align-top text-sm text-slate-400">
                          0.00
                        </td>
                        <td className="px-2 py-3 align-top text-sm text-slate-400">
                          —
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
                    return sum + getLineTaxAmount(item);
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
                  {formatNumber(getTotal())}
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
              <span className="text-slate-500">Total </span>
              <span className="font-bold tabular-nums text-slate-900">
                ₦{formatNumber(getTotal())}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Memo Drawer */}
      <Drawer open={isMemoDrawerOpen} onOpenChange={setIsMemoDrawerOpen}>
        <DrawerContent
          side="right"
          className="flex h-full !w-[600px] max-w-[600px] flex-col gap-0 overflow-hidden border-l border-slate-200 bg-white p-0 [&>button]:hidden"
        >
          <DrawerHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy,#0f2744)] px-5 py-4 pr-12 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <DrawerTitle className="flex items-center gap-2 text-lg font-semibold text-white">
                  <FileText className="h-5 w-5 text-white/90" />
                  View Expenses Memos
                </DrawerTitle>
                <DrawerDescription className="mt-0.5 text-xs text-white/70">
                  Add approved memos to this bill. Closed / treated memos leave this list.
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setSelectedMemoIds([]);
                  }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loadingMemos ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-6 w-6 animate-spin text-[var(--aa-navy,#0f2744)]" />
                <span className="ml-2 text-slate-600">Loading memos...</span>
              </div>
            ) : memos.filter((m) => m.status !== "closed").length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <p className="mb-2 text-slate-600">No memos found</p>
                <p className="text-sm text-slate-500">
                  There are no available memos to add to the bill
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {memos
                  .filter((memo) => memo.status !== "closed")
                  .map((memo) => (
                    <div
                      key={memo.memo_id || memo._id}
                      className={`rounded-lg border-2 bg-white p-4 transition-all hover:shadow-md ${
                        selectedMemoIds.includes(memo.memo_id)
                          ? "cursor-not-allowed border-[var(--aa-navy,#0f2744)]/40 bg-[var(--aa-sidebar-active,#e8f1fc)] opacity-60"
                          : "border-slate-200 hover:border-[var(--aa-navy,#0f2744)]/50"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">
                              {memo.memo_id}
                            </h3>
                            <span
                              className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${
                                memo.status === "approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : memo.status === "pending"
                                    ? "bg-[var(--aa-navy,#0f2744)] text-white"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {memo.status}
                            </span>
                          </div>
                          {memo.subject && (
                            <p className="mb-2 text-sm text-slate-700">
                              {memo.subject}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMemoToClose(memo);
                            setShowCloseMemoModal(true);
                          }}
                          className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Close this memo"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                        {memo.date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-[var(--aa-navy,#0f2744)]" />
                            <span>
                              {moment(memo.date).format("MMM DD, YYYY")}
                            </span>
                          </div>
                        )}
                        {(memo.supplier_name || memo.supplier_number) && (
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-[var(--aa-navy,#0f2744)]" />
                            <span className="truncate font-medium">
                              {memo.supplier_name || memo.supplier_number}
                            </span>
                          </div>
                        )}
                        {memo.from_name && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3 text-[var(--aa-navy,#0f2744)]" />
                            <span className="truncate">{memo.from_name}</span>
                          </div>
                        )}
                      </div>
                      {memo.items && memo.items.length > 0 && (
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          <div className="space-y-2">
                            {memo.items.slice(0, 3).map((item, index) => (
                              <div
                                key={item.item_list_id || item.id || index}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-2 pl-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h4 className="text-sm font-medium text-slate-900">
                                      {item.description || item.item_name}
                                    </h4>
                                    <p className="text-xs text-slate-600">
                                      {item.item_code || item.sku}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-slate-900">
                                      Qty: {item.quantity || 1}
                                    </div>
                                    <div className="text-xs text-slate-600">
                                      ₦
                                      {formatNumber(
                                        item.unit_cost ||
                                          item.cost ||
                                          item.amount,
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {memo.items.length > 3 && (
                              <div className="text-center text-xs text-slate-500">
                                + {memo.items.length - 3} more items
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            // Keep drawer open so additional memos can be added
                            addMemoItems(memo);
                          }}
                          className="w-full rounded-md bg-[var(--aa-navy,#0f2744)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--aa-navy-hover,#243a73)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={selectedMemoIds.includes(memo.memo_id)}
                        >
                          {selectedMemoIds.includes(memo.memo_id)
                            ? "✓ Added to List"
                            : `Add to List (${memo.item_count || 0} items)`}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Add lines if needed, then close memo so it leaves this list
                            if (!selectedMemoIds.includes(memo.memo_id)) {
                              const added = addMemoItems(memo);
                              if (!added) return;
                            }
                            closeMemoStatus(memo, { addItems: false });
                          }}
                          className="w-full rounded-md border border-[var(--aa-navy,#0f2744)] bg-white px-3 py-2 text-sm font-semibold text-[var(--aa-navy,#0f2744)] transition-colors hover:bg-[var(--aa-sidebar-active,#e8f1fc)] disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={closingMemoId === memo.memo_id}
                        >
                          {closingMemoId === memo.memo_id
                            ? "Closing..."
                            : selectedMemoIds.includes(memo.memo_id)
                              ? "Close Memo"
                              : "Add & Close"}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      {/* Memo Close Confirmation Modal */}
      {showCloseMemoModal && memoToClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Close Memo
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Are you sure you want to close memo{" "}
                  <span className="font-semibold">{memoToClose.memo_id}</span>?
                  You will not be able to add items from this memo again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCloseMemoModal(false);
                  setMemoToClose(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowCloseMemoModal(false);
                  setMemoToClose(null);
                }}
                className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (memoToClose) {
                    closeMemoStatus(memoToClose, { addItems: false });
                  }
                  setShowCloseMemoModal(false);
                  setMemoToClose(null);
                }}
                disabled={!!closingMemoId}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {closingMemoId ? "Closing..." : "Yes, Close Memo"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateImprestDrawer
        open={imprestOpen}
        onOpenChange={setImprestOpen}
        expenseList={expenseList}
        facilityId={activeBusiness?.id || activeBusiness?._id}
        user={user}
        prefillLine={
          currentItem.head && (currentItem.description || currentItem.item_name)
            ? currentItem
            : null
        }
      />
    </div>
  );
}
