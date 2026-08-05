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
  Edit2,
  Check,
  AlertCircle,
  Info,
  DollarSign,
  Banknote,
  ChevronLeft,
  Printer,
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

const initialItemForm = {
  item_name: "",
  sku: "",
  quantity: "",
  cost: "",
  total: 0,
  item_type: "",
  taxable: "Not Taxable",
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
    mode_of_payment: "",
    mod_account_code: "",
    cheque_number: "",
  });

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(initialItemForm);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [productList, setProductList] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [accountList, setAccountList] = useState([]);
  const hasAutoSelectedSupplier = useRef(false);

  // Tax-related state
  const [taxes, setTaxes] = useState([]);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);
  const [showTaxSelection, setShowTaxSelection] = useState(true);
  const vatPolicy = activeBusiness?.vat_policy || "vat_exclusive";

  // Editing state
  const [editingItem, setEditingItem] = useState(null);

  // Expenses memo drawer state
  const [isMemoDrawerOpen, setIsMemoDrawerOpen] = useState(false);
  const [memos, setMemos] = useState([]);
  const [loadingMemos, setLoadingMemos] = useState(false);
  const [selectedMemoIds, setSelectedMemoIds] = useState([]);
  const [closingMemoId, setClosingMemoId] = useState(null);
  const [showCloseMemoModal, setShowCloseMemoModal] = useState(false);
  const [memoToClose, setMemoToClose] = useState(null);
  const [memosToClose, setMemosToClose] = useState([]);

  // Advance modal state
  const [showPrepaymentModal, setShowPrepaymentModal] = useState(false);
  const [supplierBalance, setSupplierBalance] = useState(0);
  const [applyPrepayment, setApplyPrepayment] = useState(false);
  const [shouldPrint, setShouldPrint] = useState(false);
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

  // Calculate tax amount for an item
  const calculateTaxAmount = (itemAmount, tax) => {
    if (!tax || !tax.rate) return 0;

    const rate = parseFloat(tax.rate);
    // Use tax's inclusive_type if available
    const isInclusive =
      tax.inclusive_type === "inclusive" ||
      (tax.inclusive_type === undefined &&
        vatPolicy === "vat_inclusive" &&
        vatPolicy !== "all");

    if (isInclusive) {
      // For inclusive tax, extract tax from the base amount
      if (tax.rate_type === "percentage") {
        const rateDecimal = rate / 100;
        if (rateDecimal === 0) return 0;
        return itemAmount - itemAmount / (1 + rateDecimal);
      } else {
        return rate; // Fixed amount in inclusive mode
      }
    } else {
      // For exclusive tax, add tax on top
      if (tax.rate_type === "percentage") {
        return (itemAmount * rate) / 100;
      } else {
        return rate; // Fixed amount
      }
    }
  };

  // Calculate total tax
  const calculateTotalTax = () => {
    if (selectedTaxes.length === 0) return 0;

    const taxableItems = items.filter((item) => item.taxable === "Taxable");
    if (taxableItems.length === 0) return 0;

    let totalTax = 0;

    // Separate taxes by inclusive_type
    const exclusiveTaxes = selectedTaxes.filter((tax) => {
      if (vatPolicy === "all") {
        return (
          tax.inclusive_type === "exclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "exclusive")
        );
      }
      return (
        tax.inclusive_type === "exclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "exclusive") ||
        (tax.inclusive_type === undefined && vatPolicy === "vat_exclusive")
      );
    });
    const inclusiveTaxes = selectedTaxes.filter((tax) => {
      if (vatPolicy === "all") {
        return (
          tax.inclusive_type === "inclusive" ||
          (tax.inclusive_type === undefined && tax.tax_type === "inclusive")
        );
      }
      return (
        tax.inclusive_type === "inclusive" ||
        (tax.inclusive_type === undefined && tax.tax_type === "inclusive") ||
        (tax.inclusive_type === undefined && vatPolicy === "vat_inclusive")
      );
    });

    // Calculate exclusive taxes: add on top
    taxableItems.forEach((item) => {
      const itemTotal =
        parseFloat(parseNumberFromFormatted(item.total?.toString() || "")) || 0;
      exclusiveTaxes.forEach((tax) => {
        totalTax += calculateTaxAmount(itemTotal, tax);
      });
    });

    // Calculate inclusive taxes: extract from subtotal
    if (inclusiveTaxes.length > 0) {
      const taxableSubtotal = taxableItems.reduce((sum, item) => {
        const itemTotal =
          parseFloat(parseNumberFromFormatted(item.total?.toString() || "")) ||
          0;
        return sum + itemTotal;
      }, 0);

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

      // Add fixed amount inclusive taxes
      inclusiveTaxes.forEach((tax) => {
        if (tax.rate_type === "fixed") {
          totalTax += parseFloat(tax.rate || 0) * taxableItems.length;
        }
      });
    }

    return totalTax;
  };

  // Get total with tax
  const getTotal = () => {
    const subtotal = calculateTotal();
    const totalTax = calculateTotalTax();

    // Check if all taxes are inclusive
    const allTaxesInclusive =
      selectedTaxes.length > 0 &&
      selectedTaxes.every((tax) => {
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

    // If all taxes are inclusive, subtotal already includes tax
    return allTaxesInclusive ? subtotal : subtotal + totalTax;
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
      },
    );
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

    // Calculate tax amounts
    const taxableItems = items.filter((item) => item.taxable === "Taxable");
    const taxableSubtotal = taxableItems.reduce((sum, item) => {
      const itemTotal =
        parseFloat(parseNumberFromFormatted(item.total?.toString() || "")) || 0;
      return sum + itemTotal;
    }, 0);

    // Calculate tax based on each tax's inclusive_type
    let taxAmount = 0;
    const taxesArray = [];

    if (selectedTaxes.length > 0 && taxableSubtotal > 0) {
      const isTaxInclusive = (tax) => {
        if (vatPolicy === "vat_inclusive") return true;
        if (vatPolicy === "vat_exclusive") return false;
        // vatPolicy === "all": per-tax decision via inclusive_type
        return (tax.inclusive_type || "").toLowerCase() === "inclusive";
      };

      const inclusiveTaxes = selectedTaxes.filter(isTaxInclusive);
      const exclusiveTaxes = selectedTaxes.filter((tax) => !isTaxInclusive(tax));

      // Calculate inclusive taxes: extract VAT from the taxable amount
      if (inclusiveTaxes.length > 0) {
        const totalInclusiveRate = inclusiveTaxes.reduce((sum, tax) => {
          if (tax.rate_type === "percentage") {
            return sum + parseFloat(tax.rate || 0) / 100;
          }
          return sum;
        }, 0);

        if (totalInclusiveRate > 0) {
          const netAmount = taxableSubtotal / (1 + totalInclusiveRate);
          taxAmount += taxableSubtotal - netAmount;
        }

        // Add fixed amount inclusive taxes
        inclusiveTaxes.forEach((tax) => {
          if (tax.rate_type === "fixed") {
            taxAmount += parseFloat(tax.rate || 0);
          }
        });
      }

      // Calculate exclusive taxes: add VAT to the taxable amount
      if (exclusiveTaxes.length > 0) {
        taxAmount += exclusiveTaxes.reduce((sum, tax) => {
          if (tax.rate_type === "percentage") {
            return sum + (taxableSubtotal * parseFloat(tax.rate || 0)) / 100;
          } else {
            return sum + parseFloat(tax.rate || 0);
          }
        }, 0);
      }

      // Build taxes array for API
      selectedTaxes.forEach((tax) => {
        const taxIsInclusive = isTaxInclusive(tax);
        let taxAmountForTax = 0;

        if (taxIsInclusive) {
          const totalRate = inclusiveTaxes.reduce((sum, t) => {
            return sum + parseFloat(t.rate || 0) / 100;
          }, 0);

          if (totalRate > 0) {
            const netAmount = taxableSubtotal / (1 + totalRate);
            const totalVAT = taxableSubtotal - netAmount;
            const taxRate = parseFloat(tax.rate || 0) / 100;
            taxAmountForTax = (totalVAT * taxRate) / totalRate;
          }
        } else {
          taxAmountForTax = (taxableSubtotal * parseFloat(tax.rate || 0)) / 100;
        }

        taxesArray.push({
          id: tax.id,
          name: tax.description || tax.name,
          description: tax.description,
          rate: parseFloat(tax.rate),
          head: tax.account_sub_head,
          amount: taxAmountForTax,
          tax_type: tax.tax_type || "exclusive",
          rate_type: tax.rate_type || "percentage",
          inclusive_type: taxIsInclusive ? "inclusive" : "exclusive",
        });
      });
    }

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
        taxable: item.taxable || "Not Taxable",
      };
    });

    // Save purchase to stock
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
        terms: form.terms || "30",
        remark: form.remark || "",
        transaction_date: form.date,
        due_date: form.due_date,
        apply_prepayment: usePrepayment,
        tax_amount: taxAmount,
        taxes: taxesArray,
      },
      (res) => {
        if (res.success) {
          // After a successful save, close any memos that were queued via "Add & Close"
          if (memosToClose.length > 0) {
            memosToClose.forEach((memoId) => {
              const memo = memos.find((m) => m.memo_id === memoId);
              if (memo) {
                closeMemoStatus(memo, { addItems: false });
              }
            });
            setMemosToClose([]);
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

  // Show all taxes (both exclusive and inclusive)
  const filteredTaxes = useMemo(() => {
    if (!taxes || taxes.length === 0) return [];
    // Return all taxes regardless of vat_policy
    return taxes;
  }, [taxes]);

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
    // Check if memo has items
    if (!memo.items || memo.items.length === 0) {
      toast.error("No items found in this memo");
      return;
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
      taxable: item.taxable || "Not Taxable",
    }));

    // Add to items list
    setItems([...items, ...memoItems]);

    // Populate Select Supplier when memo has supplier details
    if (memo.supplier_number || memo.supplier_name) {
      setForm((prev) => ({
        ...prev,
        supplier_name: memo.supplier_name || prev.supplier_name,
        supplier_code: memo.supplier_code || prev.supplier_code,
        supplier_number: memo.supplier_number || prev.supplier_number,
        supplier_subhead: memo.account_code || memo.supplier_subhead || prev.supplier_subhead,
      }));
    }

    // Add memo ID to selected list to prevent re-adding
    if (!selectedMemoIds.includes(memo.memo_id)) {
      setSelectedMemoIds((prev) => [...prev, memo.memo_id]);
    }

    toast.success(
      `Added ${memoItems.length} item(s) from memo ${memo.memo_id}`,
    );
  };

  // Close memo (update status to "closed")
  const closeMemoStatus = (memo, { addItems } = { addItems: false }) => {
    if (!activeBusiness?.id && !activeBusiness?._id) {
      toast.error("Active business not found");
      return;
    }

    // Optionally add items before closing
    if (addItems) {
      addMemoItems(memo);
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
          // Update memo status locally so it still shows as closed in lists
          setMemos((prev) =>
            prev.map((m) =>
              m.memo_id === memo.memo_id ? { ...m, status: "closed" } : m,
            ),
          );
          // Reload memos from the server so the drawer list stays in sync
          // (e.g. after using the cancel-close icon)
          fetchMemos();
          // Track as processed
          setSelectedMemoIds((prev) =>
            prev.includes(memo.memo_id) ? prev : [...prev, memo.memo_id],
          );
          if (addItems) {
            setIsMemoDrawerOpen(false);
          }
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
    if (
      form.mode_of_payment === "bank" ||
      form.mode_of_payment === "cash" ||
      form.mode_of_payment === "cheque"
    ) {
      _postApi(
        `/inventory/product-list?query_type=${form.mode_of_payment}`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) {
            setAccountList(resp.results);
          } else {
            toast.error("Failed to load list of items.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Something went wrong while fetching data.");
        },
      );
    } else {
      setAccountList([]);
    }
  }, [form.mode_of_payment]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-0">
      <div className="max-w-7xl mx-auto">
        {/* Main Form Card */}
        <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-slate-200">
          {/* Transaction Details Section */}
          <div className="flex items-center gap-4 bg-slate-50 border-b border-slate-200 px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="h-6 w-px bg-slate-300" /> {/* Divider */}
            <div className="flex items-center gap-2.5">
              <Banknote className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Expenses Bill
              </h2>
            </div>
          </div>

          <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={form.due_date}
                  onChange={handleFormChange}
                  min={form.date}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Supplier <span className="text-red-500">*</span>
                </label>
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
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white hover:border-slate-400"
                >
                  <option value="">Select supplier...</option>
                  {/* Show memo's supplier when added from memo but not yet in supplierList */}
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
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Payment Terms
                </label>
                <CreatableSelect
                  className="w-full text-sm"
                  classNamePrefix="react-select"
                  placeholder="Select or type payment terms"
                  options={termOptions}
                  /* ✅ supports both predefined & custom values */
                  value={
                    termOptions.find((opt) => opt.value === form.terms) ||
                    (form.terms
                      ? { value: form.terms, label: `${form.terms} days` }
                      : null)
                  }
                  onChange={(selected) => {
                    const termsValue = selected?.value || "";
                    handleFormChange({
                      target: {
                        name: "terms",
                        value: termsValue,
                      },
                    });

                    // Recalculate due date when terms change
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
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Remark/Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="remark"
                value={form.remark}
                onChange={handleFormChange}
                rows="2"
                placeholder="Enter transaction description..."
                className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none hover:border-slate-400"
              />
            </div>
          </div>

          {/* Add Items Section */}
          <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 px-6 py-3.5 border-t-2 border-b-2 border-green-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-600" />
              Add Items
            </h2>
            <div className="flex flex-wrap items-center gap-3">

              <button
                onClick={handleOpenMemoDrawer}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer text-left"
              >
                View Expenses Memos
              </button>
            </div>
          </div>

          <div className="p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 items-end">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expense <span className="text-red-500">*</span>
                </label>
                <Typeahead
                  ref={expenseSelectRef}
                  id="expense-typeahead"
                  labelKey={(option) =>
                    `${option.name || ""} (${option.code || ""})`
                  }
                  options={expenseList}
                  placeholder="Select expense..."
                  onChange={(selectedItems) => {
                    if (selectedItems && selectedItems.length > 0) {
                      const expense = selectedItems[0];
                      setCurrentItem((prev) => ({
                        ...prev,
                        item_name: expense.name || "",
                        head: expense.code || "",
                        account_type: expense.account_type || "",
                        // Don't auto-set description - keep existing or empty
                      }));
                    } else {
                      // Clear selection when user deselects
                      setCurrentItem((prev) => ({
                        ...prev,
                        item_name: "",
                        head: "",
                        // Keep existing description when clearing
                      }));
                    }
                  }}
                  selected={
                    currentItem.item_name && currentItem.head
                      ? expenseList.filter(
                          (expense) =>
                            expense.code === currentItem.head &&
                            expense.name === currentItem.item_name,
                        )
                      : []
                  }
                  clearButton
                  allowNew={false}
                  renderMenuItemChildren={(option) => (
                    <div className="py-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">
                          {option.name || "Description"}
                        </span>
                        <span className="text-slate-600 text-xs">
                          ({option.code})
                        </span>
                      </div>
                      {option.account_type && (
                        <small className="text-slate-500 text-xs">
                          Type: {option.account_type}
                        </small>
                      )}
                    </div>
                  )}
                  inputProps={{
                    style: {
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      border: "2px solid rgb(203 213 225)",
                      borderRadius: "0.5rem",
                      minHeight: "40px",
                    },
                    className:
                      "focus:border-green-500 focus:ring-2 focus:ring-green-500",
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={currentItem.description || ""}
                  onChange={handleItemChange}
                  placeholder="Enter description..."
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="quantity"
                  value={currentItem.quantity || ""}
                  onChange={handleItemChange}
                  placeholder="0"
                  inputMode="decimal"
                  className="text-center w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit Cost <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="cost"
                  value={currentItem.cost || ""}
                  onChange={handleItemChange}
                  placeholder="0.00"
                  inputMode="decimal"
                  className="text-right w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total
                </label>
                <input
                  type="text"
                  value={formatNumber(currentItem.total)}
                  disabled
                  readOnly
                  className="text-center w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 font-semibold cursor-not-allowed"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Taxable
                </label>
                <div className="flex items-center h-10">
                  <input
                    type="checkbox"
                    name="taxable"
                    checked={currentItem.taxable === "Taxable"}
                    onChange={(e) => {
                      handleItemChange({
                        target: {
                          name: "taxable",
                          value: e.target.checked ? "Taxable" : "Not Taxable",
                        },
                      });
                    }}
                    className="w-5 h-5 text-green-600 border-2 border-slate-300 rounded focus:ring-2 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <label className="ml-2 text-sm text-slate-700 cursor-pointer">
                    Mark as Taxable
                  </label>
                </div>
              </div>

              <div className="md:col-span-1">
                {editingItem ? (
                  <div className="flex gap-1">
                    <button
                      onClick={saveEditedItem}
                      className="flex-1 px-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center justify-center gap-1 font-medium shadow-md hover:shadow-lg"
                      title="Save changes"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center justify-center gap-1 font-medium shadow-md hover:shadow-lg"
                      title="Cancel editing"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 w-full">
                   
                    <button
                      type="button"
                      onClick={addItem}
                      className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl p-4 border-2 border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    Items List
                  </h3>
                  <span className="text-xs font-medium text-slate-600 bg-blue-50 px-2 py-1 rounded">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr className="border-b-2 border-slate-200">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                          Account Description
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700">
                          Taxable
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                          Description
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                          Quantity
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                          Unit Cost
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                          Total
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr
                          key={item._id}
                          className={`border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer ${
                            editingItem === item._id ? "bg-blue-50" : ""
                          }`}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                        >
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <Typeahead
                              id={`expense-typeahead-${item._id}`}
                              labelKey={(option) =>
                                `${option.name || ""} (${option.code || ""})`
                              }
                              options={expenseList}
                              placeholder="Select expense..."
                              onChange={(selectedItems) => {
                                if (selectedItems && selectedItems.length > 0) {
                                  const expense = selectedItems[0];
                                  setItems(
                                    items.map((i) =>
                                      i._id === item._id
                                        ? {
                                            ...i,
                                            item_name: expense.name || "",
                                            head: expense.code || "",
                                            account_type:
                                              expense.account_type || "",
                                            // Don't auto-set description - keep existing
                                          }
                                        : i,
                                    ),
                                  );
                                } else {
                                  setItems(
                                    items.map((i) =>
                                      i._id === item._id
                                        ? { ...i, item_name: "", head: "" }
                                        : i,
                                    ),
                                  );
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
                                <div className="py-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {option.name || "Description"}
                                    </span>
                                    <span className="text-slate-600 text-xs">
                                      ({option.code})
                                    </span>
                                  </div>
                                  {option.account_type && (
                                    <small className="text-slate-500 text-xs">
                                      Type: {option.account_type}
                                    </small>
                                  )}
                                </div>
                              )}
                              inputProps={{
                                style: {
                                  padding: "0.5rem 0.75rem",
                                  fontSize: "0.875rem",
                                  border: "2px solid rgb(203 213 225)",
                                  borderRadius: "0.5rem",
                                  minHeight: "40px",
                                },
                                className:
                                  "focus:border-green-500 focus:ring-2 focus:ring-green-500",
                              }}
                              positionFixed={true}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <label className="flex items-center justify-center cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={item.taxable === "Taxable"}
                                onChange={(e) => {
                                  setItems(
                                    items.map((i) =>
                                      i._id === item._id
                                        ? {
                                            ...i,
                                            taxable: e.target.checked
                                              ? "Taxable"
                                              : "Not Taxable",
                                          }
                                        : i,
                                    ),
                                  );
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                              />
                              {item.taxable === "Taxable" && (
                                <span className="ml-2 text-xs text-green-600 font-medium">
                                  Taxable
                                </span>
                              )}
                            </label>
                          </td>
                          <td className="px-3 py-2 text-xs font-medium text-slate-800">
                            <span>{item.description}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 text-right">
                            {formatNumber(
                              parseFloat(
                                parseNumberFromFormatted(item.quantity || ""),
                              ) || 0,
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 text-right">
                            {editingItem === item._id ? (
                              <input
                                type="text"
                                name="cost"
                                value={item.cost || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Remove commas first, then sanitize
                                  const withoutCommas = value.replace(/,/g, "");
                                  const sanitizedValue =
                                    handleNumericInput(withoutCommas);

                                  // Prevent multiple decimal points
                                  const parts = sanitizedValue.split(".");
                                  const numericValue =
                                    parts.length > 2
                                      ? parts[0] + "." + parts.slice(1).join("")
                                      : sanitizedValue;

                                  // Format with commas for display
                                  const formattedValue =
                                    formatNumberWithCommas(numericValue);

                                  // Calculate total using parsed values
                                  const costParsed =
                                    parseNumberFromFormatted(formattedValue);
                                  const qtyParsed = parseNumberFromFormatted(
                                    item.quantity || "",
                                  );
                                  const cost =
                                    costParsed === ""
                                      ? 0
                                      : parseFloat(costParsed) || 0;
                                  const qty =
                                    qtyParsed === ""
                                      ? 0
                                      : parseFloat(qtyParsed) || 0;

                                  const updatedItems = items.map((i) =>
                                    i._id === item._id
                                      ? {
                                          ...i,
                                          cost: formattedValue,
                                          total: cost * qty,
                                        }
                                      : i,
                                  );
                                  setItems(updatedItems);
                                }}
                                inputMode="decimal"
                                className="text-right px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white w-full"
                              />
                            ) : (
                              "₦" +
                              formatNumber(
                                parseFloat(
                                  parseNumberFromFormatted(item.cost || ""),
                                ) || 0,
                              )
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs font-semibold text-slate-800 text-right">
                            ₦{formatNumber(item.total)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleItemDoubleClick(item)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Edit item"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => removeItem(item._id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Remove item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Grand Total */}
                <div className="mt-4 space-y-2">
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-slate-700">
                        Subtotal:
                      </span>
                      <span className="text-lg font-semibold text-slate-800">
                        ₦{formatNumber(calculateTotal())}
                      </span>
                    </div>

                    {/* Tax Display */}
                    {selectedTaxes.length > 0 && calculateTotalTax() > 0 && (
                      <>
                        {selectedTaxes.map((tax) => {
                          const taxableItems = items.filter(
                            (item) => item.taxable === "Taxable",
                          );
                          const taxableSubtotal = taxableItems.reduce(
                            (sum, item) => {
                              const itemTotal =
                                parseFloat(
                                  parseNumberFromFormatted(
                                    item.total?.toString() || "",
                                  ),
                                ) || 0;
                              return sum + itemTotal;
                            },
                            0,
                          );

                          // Determine if tax is inclusive or exclusive
                          const isInclusive =
                            tax.inclusive_type === "inclusive" ||
                            (tax.inclusive_type === undefined &&
                              tax.tax_type === "inclusive") ||
                            (tax.inclusive_type === undefined &&
                              vatPolicy === "vat_inclusive" &&
                              vatPolicy !== "all");

                          let taxAmountForDisplay = 0;

                          if (isInclusive) {
                            // For inclusive taxes, calculate proportionally
                            const inclusiveTaxes = selectedTaxes.filter((t) => {
                              if (vatPolicy === "all") {
                                return (
                                  t.inclusive_type === "inclusive" ||
                                  (t.inclusive_type === undefined &&
                                    t.tax_type === "inclusive")
                                );
                              }
                              return (
                                t.inclusive_type === "inclusive" ||
                                (t.inclusive_type === undefined &&
                                  vatPolicy === "vat_inclusive")
                              );
                            });

                            const totalRate = inclusiveTaxes.reduce(
                              (sum, t) => {
                                if (t.rate_type === "percentage") {
                                  return sum + parseFloat(t.rate || 0) / 100;
                                }
                                return sum;
                              },
                              0,
                            );

                            if (totalRate > 0) {
                              const netAmount =
                                taxableSubtotal / (1 + totalRate);
                              const totalVAT = taxableSubtotal - netAmount;
                              const taxRate = parseFloat(tax.rate || 0) / 100;
                              taxAmountForDisplay =
                                (totalVAT * taxRate) / totalRate;
                            }
                          } else {
                            // For exclusive taxes
                            if (tax.rate_type === "percentage") {
                              taxAmountForDisplay =
                                (taxableSubtotal * parseFloat(tax.rate || 0)) /
                                100;
                            } else {
                              taxAmountForDisplay = parseFloat(tax.rate || 0);
                            }
                          }

                          return (
                            <div
                              key={tax.id}
                              className="flex justify-between items-center mb-1"
                            >
                              <span className="text-sm text-slate-600">
                                {tax.description} ({tax.rate}%)
                                {isInclusive ? (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                    Inc
                                  </span>
                                ) : (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                    Exc
                                  </span>
                                )}
                                :
                              </span>
                              <span className="text-sm font-semibold text-slate-800">
                                ₦{formatNumber(taxAmountForDisplay)}
                              </span>
                            </div>
                          );
                        })}
                        {selectedTaxes.length > 1 && (
                          <div className="flex justify-between items-center mb-2 pt-1 border-t border-green-200">
                            <span className="text-sm font-medium text-slate-700">
                              Total Tax:
                            </span>
                            <span className="text-sm font-semibold text-slate-800">
                              ₦{formatNumber(calculateTotalTax())}
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t-2 border-green-300">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Package className="w-4 h-4 text-green-700" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">
                          Grand Total
                        </span>
                      </div>
                      <span className="text-2xl font-bold text-green-700">
                        ₦{formatNumber(getTotal())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tax Selection Section */}
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => setShowTaxSelection(!showTaxSelection)}
                  className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
                >
                  <span>Apply Taxes</span>
                  {showTaxSelection ? (
                    <ChevronLeft className="w-4 h-4 rotate-90" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 -rotate-90" />
                  )}
                </button>
                {activeBusiness?.vat_policy && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                    VAT:{" "}
                    {activeBusiness.vat_policy === "vat_inclusive"
                      ? "Inclusive"
                      : activeBusiness.vat_policy === "vat_exclusive"
                        ? "Exclusive"
                        : "All"}
                  </span>
                )}
              </div>
              {showTaxSelection && filteredTaxes.length > 0 && (
                <p className="text-xs text-blue-600 mb-2">
                  Both inclusive and exclusive taxes are available. Select taxes
                  to apply.
                </p>
              )}

              {/* Tax Selection Toggles - Show when expanded */}
              {showTaxSelection && (
                <>
                  {filteredTaxes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {filteredTaxes.map((tax) => {
                        const isSelected = selectedTaxes.some(
                          (t) => t.id === tax.id,
                        );
                        // Determine if tax is inclusive or exclusive
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
                            className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
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
                                ></div>
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
                  {filteredTaxes.length === 0 && !loadingTaxes && (
                    <p className="text-xs text-gray-500 mt-2">
                      No taxes available for purchase category
                    </p>
                  )}
                  {loadingTaxes && (
                    <p className="text-xs text-gray-500 mt-2">
                      Loading taxes...
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-5 border-t-2 border-slate-200">
            <div className="flex items-center justify-between">
              {/* Summary Info */}
              <div className="flex items-center gap-4">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">Items:</span> {items.length}
                </div>
                {items.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">
                      Total Amount:
                    </span>
                    <span className="text-lg font-bold text-green-600">
                      ₦{formatNumber(getTotal())}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  disabled={loading}
                  className="px-3 py-2.5 text-sm bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 rounded-lg transition-all flex items-center gap-2 font-semibold shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden lg:inline">Cancel</span>
                </button>
                <button
                  onClick={() => handleDirectPurchase(true)}
                  disabled={loading}
                  className="px-3 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  {loading ? (
                    <>
                      <span className="animate-pulse">Processing...</span>
                    </>
                  ) : (
                    <span className="hidden lg:inline">Save and print</span>
                  )}
                </button>
                <button
                  onClick={() => handleDirectPurchase(false)}
                  disabled={loading}
                  className="px-3 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {loading ? (
                    <>
                      <span className="animate-pulse">Processing...</span>
                    </>
                  ) : (
                    <span className="hidden lg:inline">Save Expense</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Memo Drawer */}
      <Drawer open={isMemoDrawerOpen} onOpenChange={setIsMemoDrawerOpen}>
        <DrawerContent
          side="right"
          className="bg-white border-gray-200 flex flex-col h-full !w-[600px] max-w-[600px]"
        >
          <DrawerHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-gray-900 text-xl">
                  View Expenses Memos
                </DrawerTitle>
                <DrawerDescription className="text-gray-600 mt-1">
                  Click &quot;Add to List&quot; button to add memo items
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => {
                    setSelectedMemoIds([]);
                  }}
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingMemos ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading memos...</span>
              </div>
            ) : memos.filter((m) => m.status !== "closed").length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No memos found</p>
                <p className="text-sm text-gray-500">
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
                      className={`bg-white border-2 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all ${
                        selectedMemoIds.includes(memo.memo_id)
                          ? "opacity-50 cursor-not-allowed border-green-400 bg-green-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-sm font-bold text-gray-900">
                              {memo.memo_id}
                            </h3>
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded inline-flex items-center">
                              {memo.status}
                            </span>
                          </div>
                          {memo.subject && (
                            <p className="text-sm text-gray-700 mb-2">
                              {memo.subject}
                            </p>
                          )}
                        </div>
                        {/* Close (cancel) icon aligned to far right */}
                        <button
                          type="button"
                          onClick={() => {
                            setMemoToClose(memo);
                            setShowCloseMemoModal(true);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                          title="Close this memo"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                        {memo.date && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {moment(memo.date).format("MMM DD, YYYY")}
                            </span>
                          </div>
                        )}
                        {(memo.supplier_name || memo.supplier_number) && (
                          <div className="flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            <span className="truncate font-medium">
                              {memo.supplier_name || memo.supplier_number}
                            </span>
                          </div>
                        )}
                        {memo.from_name && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            <span className="truncate">{memo.from_name}</span>
                          </div>
                        )}
                      </div>
                      {/* Items section - now always visible since items are included in the API response */}
                      {memo.items && memo.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="space-y-2">
                            {memo.items.slice(0, 3).map((item, index) => (
                              <div
                                key={item.item_list_id || item.id || index}
                                className="bg-gray-50 border border-gray-200 rounded-lg p-2 pl-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h4 className="text-sm font-medium text-gray-900">
                                      {item.description || item.item_name}
                                    </h4>
                                    <p className="text-xs text-gray-600">
                                      {item.item_code || item.sku}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-medium text-gray-900">
                                      Qty: {item.quantity || 1}
                                    </div>
                                    <div className="text-xs text-gray-600">
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
                              <div className="text-xs text-gray-500 text-center">
                                + {memo.items.length - 3} more items
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 space-y-2">
                        <button
                          onClick={() => {
                            addMemoItems(memo);
                            setIsMemoDrawerOpen(false);
                          }}
                          className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={selectedMemoIds.includes(memo.memo_id)}
                        >
                          {selectedMemoIds.includes(memo.memo_id)
                            ? "✓ Added to List"
                            : `Add to List (${memo.item_count || 0} items)`}
                        </button>
                        <button
                          onClick={() => {
                            // Add items now and queue this memo to be closed after save
                            addMemoItems(memo);
                            setMemosToClose((prev) =>
                              prev.includes(memo.memo_id)
                                ? prev
                                : [...prev, memo.memo_id],
                            );
                            setIsMemoDrawerOpen(false);
                          }}
                          className="w-full px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={selectedMemoIds.includes(memo.memo_id)}
                        >
                          Add &amp; Close
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Advance Confirmation Modal */}
      {showPrepaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full transform transition-all animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-5 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">
                      Supplier Advance Available
                    </h3>
                    <p className="text-sm text-amber-100 mt-1">
                      You must apply this advance to the transaction
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPrepaymentModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Warning Banner */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-r-lg p-2">
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

              {/* Amount Cards */}
              <div className="grid grid-cols-1 gap-3">
                {/* Available Advance */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign className="w-5 h-5 text-green-700" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Available Advance
                        </p>
                        <p className="text-2xl font-bold text-green-700 mt-1">
                          ₦{formatNumber(Math.abs(supplierBalance))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaction Amount */}
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-200 rounded-xl p-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Package className="w-5 h-5 text-slate-700" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Transaction Amount
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          ₦{formatNumber(calculateTotal())}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advance Status */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Check className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">
                      Advance Application Status
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      Advance will be automatically applied to this transaction
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-blue-200 rounded-full">
                    <span className="text-xs font-bold text-blue-800">
                      REQUIRED
                    </span>
                  </div>
                </div>
              </div>

              {/* Remaining Payable */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-xl p-2 shadow-md">
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                    Remaining Payable After Advance
                  </p>
                  <p className="text-3xl font-bold text-emerald-700">
                    ₦
                    {formatNumber(
                      Math.max(0, calculateTotal() - Math.abs(supplierBalance)),
                    )}
                  </p>
                  {Math.abs(supplierBalance) >= calculateTotal() && (
                    <p className="text-sm text-emerald-600 mt-2 font-medium">
                      ✓ Fully covered by advance
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-2xl border-t border-gray-200">
              <button
                onClick={handlePrepaymentCancel}
                className="px-5 py-2.5 text-sm bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 rounded-lg transition-all font-semibold shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                onClick={handlePrepaymentConfirm}
                disabled={loading}
                className="px-6 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
