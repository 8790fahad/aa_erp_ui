/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import {
  Save,
  Plus,
  Trash2,
  Package,
  Calendar,
  FileText,
  X,
  Banknote,
  Loader,
  Edit2,
  Check,
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
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { POSTING_DATE_MIN, getPostingDateMax } from "@/utilities";
import { v4 as uuidv4 } from "uuid";
import useQuery from "@/hooks/useQuery";
import { Button } from "@/components/ui/button";

const initialItemForm = {
  item_name: "",
  sku: "",
  quantity: "",
  cost: "",
  total: 0,
  item_type: "",
  description: "",
  taxable: false,
};

export default function OperatingCashExpenses() {
  const query = useQuery();
  const productTypeaheadRef = useRef();
  const cashAccountTypeaheadRef = useRef();
  const dispatch = useDispatch();
  const { supplierList } = useSelector((d) => d.suppliers) || [];
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const today = moment().format("YYYY-MM-DD");

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
  // Keeping productList for potential future extensions (e.g. product-linked expenses)
  // eslint-disable-next-line no-unused-vars
  const [productList, setProductList] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const hasAutoSelectedSupplier = useRef(false);
  const navigate = useNavigate();

  // Editing state
  const [editingItem, setEditingItem] = useState(null);

  // Expenses memo drawer state
  const [isMemoDrawerOpen, setIsMemoDrawerOpen] = useState(false);
  const [memos, setMemos] = useState([]);
  const [loadingMemos, setLoadingMemos] = useState(false);
  const [selectedMemoIds, setSelectedMemoIds] = useState([]);
  const [closingMemoId, setClosingMemoId] = useState(null);
  const [bankAccount, setBankAccount] = useState({});
  const [headList, setHeadList] = useState([]);
  const [accountHead, setAccountHead] = useState({});
  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    const updatedItem = { ...currentItem, [name]: value };

    if (name === "quantity" || name === "cost") {
      const qty =
        name === "quantity"
          ? parseFloat(value) || 0
          : parseFloat(updatedItem.quantity) || 0;
      const cost =
        name === "cost"
          ? parseFloat(value) || 0
          : parseFloat(updatedItem.cost) || 0;
      updatedItem.total = qty * cost;
    }

    setCurrentItem(updatedItem);
  };

  const addItem = () => {
    if (
      !currentItem.item_name ||
      !currentItem.quantity ||
      !currentItem.description ||
      !currentItem.cost
      // ||
      // !currentItem.item_type
    ) {
      toast.error("Please fill in all item fields");
      return;
    }

    const newItem = {
      ...currentItem,
      _id: uuidv4(),
      total: parseFloat(currentItem.quantity) * parseFloat(currentItem.cost),
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
      !currentItem.description ||
      !currentItem.cost ||
      !currentItem.item_type
    ) {
      toast.error("Please fill in all item fields");
      return;
    }

    setItems(
      items.map((item) =>
        item._id === editingItem
          ? {
              ...currentItem,
              total:
                parseFloat(currentItem.quantity) * parseFloat(currentItem.cost),
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

  const handleDirectPurchase = () => {
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
    if (!form.mode_of_payment) {
      toast.error("Please select a mode of payment");
      return;
    }
    if (form.mode_of_payment === "bank" && !bankAccount?.id) {
      toast.error("Please select a bank account");
      return;
    }
    if (form.mode_of_payment === "cash" && !accountHead?.head) {
      toast.error("Please select a cash account");
      return;
    }
    if (form.mode_of_payment === "cheque" && !form.cheque_number) {
      toast.error("Please enter a cheque number");
      return;
    }
    if (!activeBusiness?.payable_code) {
      toast.error("Payable code is not set");
      return;
    }

    // Prepare purchase data with items
    const purchaseData = items.map((item) => ({
      head: item.head || item.item_type,
      description: item.description || item.item_name,
      quantity: item.quantity,
      cost: item.cost,
      qty: item.quantity,
    }));
    setLoading(true);
    // Save purchase to stock
    _postApi(
      `/account/direct-expenses`,
      {
        data: purchaseData,
        facilityId: activeBusiness._id,
        payable_code: activeBusiness.payable_code,
        supplier_advance: activeBusiness.payable_accural_code,
        user_id: user.id,
        supplier_no: form.supplier_number,
        terms: form.terms,
        cheque_number: form.cheque_number,
        remark: form.remark,
        transaction_date: form.date,
        due_date: form.due_date,
        bankAccount,
        accountHead,
        mode_of_payment: form.mode_of_payment,
      },
      (res) => {
        if (res.success) {
          // Create ledger entries
          toast.success(
            res.message || "Expense purchase recorded successfully",
          );
          setLoading(false);
          navigate(-1);
        } else {
          toast.error(res.message || "Failed to save expense purchase");
          console.error("Purchase response:", res);
          setLoading(false);
        }
      },
      (err) => {
        toast.error(err.message);
        console.error(err);
        setLoading(false);
      },
    );
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
            resp.results.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
              account_type: item.account_type,
              show: item.show,
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
      taxable: item.taxable || false,
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

  // Close memo (update status to "closed") – can be done with or without adding items
  const handleCloseMemo = (memo, { addItems } = { addItems: false }) => {
    if (!activeBusiness?.id) {
      toast.error("Active business not found");
      return;
    }

    // Optionally add memo items to the list
    if (addItems) {
      addMemoItems(memo);
    }

    setClosingMemoId(memo.memo_id);
    _postApi(
      "/account/close-memo",
      {
        memo_id: memo.memo_id,
        facilityId: activeBusiness.id,
        user_id: user.id,
      },
      (resp) => {
        setClosingMemoId(null);
        if (resp.success) {
          toast.success(resp.message || "Memo closed successfully");
          // Remove closed memo from the list so it can't be reused
          setMemos((prev) => prev.filter((m) => m.memo_id !== memo.memo_id));
          // Track as selected/processed
          setSelectedMemoIds((prev) =>
            prev.includes(memo.memo_id) ? prev : [...prev, memo.memo_id],
          );
          // If we added items as well, close the drawer
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
    // Clear bank account and account head when payment mode changes
    setBankAccount({});
    setAccountHead({});
    setAccountList([]);
    setHeadList([]);

    if (form.mode_of_payment === "cash") {
      _postApi(
        `/inventory/product-list?query_type=${form.mode_of_payment}`,
        { facilityId: activeBusiness.id },
        (resp) => {
          if (resp.success) {
            setHeadList(resp?.results);
          } else {
            toast.error("Failed to load list of items.");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Something went wrong while fetching data.");
        },
      );
    } else if (
      form.mode_of_payment === "cheque" ||
      form.mode_of_payment === "bank"
    ) {
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
                Expenses Bill By Cash
              </h2>
            </div>
          </div>

          <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  min={POSTING_DATE_MIN}
                  max={getPostingDateMax()}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all hover:border-slate-400"
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
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all bg-white hover:border-slate-400"
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
                  Mode of Payment
                </label>
                <select
                  name="mode_of_payment"
                  value={form.mode_of_payment}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all bg-white hover:border-slate-400"
                >
                  <option value="">Select Mode of Payment</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>

              {(form.mode_of_payment === "bank" ||
                form.mode_of_payment === "cash" ||
                form.mode_of_payment === "cheque") && (
                <div>
                  {["bank", "cheque"].includes(form.mode_of_payment) ? (
                    <>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Bank Account
                      </label>
                      <select
                        name="bankAccount"
                        value={bankAccount?.id || ""}
                        onChange={(e) => {
                          const selectedAccount = accountList.find(
                            (account) => account.id === Number(e.target.value),
                          );
                          if (selectedAccount) {
                            setBankAccount(selectedAccount);
                          } else {
                            setBankAccount({});
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all bg-white hover:border-slate-400"
                      >
                        <option value="">Select account...</option>
                        {accountList.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.account_name} ({account.id})
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Account Head
                      </label>
                      <Typeahead
                        ref={cashAccountTypeaheadRef}
                        id="cash-account-typeahead"
                        labelKey={(option) =>
                          `${option.head} ${option.description}`
                        }
                        options={headList}
                        placeholder="Select cash on hand item..."
                        onChange={(selectedItems) => {
                          if (selectedItems && selectedItems.length > 0) {
                            const cash = selectedItems[0];
                            setAccountHead({
                              head: cash.head || "",
                              description: cash.description || "",
                            });
                          } else {
                            setAccountHead({});
                          }
                        }}
                        selected={
                          accountHead?.head
                            ? headList.filter(
                                (cash) => cash.head === accountHead.head,
                              )
                            : []
                        }
                        clearButton
                        allowNew={false}
                        renderMenuItemChildren={(option) => (
                          <div className="py-1">
                            <div className="font-semibold text-slate-800">
                              {option.head} {option.description}
                            </div>
                            {option.account_type && (
                              <small className="text-slate-600 text-xs">
                                Type: {option.account_type}
                              </small>
                            )}
                          </div>
                        )}
                        inputProps={{
                          style: {
                            width: "100%",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.875rem",
                            lineHeight: "1.25rem",
                            border: "2px solid rgb(203 213 225)",
                            borderRadius: "0.5rem",
                            transition: "all 0.15s ease-in-out",
                          },
                          onFocus: (e) => {
                            e.target.style.outline = "none";
                            e.target.style.borderColor = "rgb(34 197 94)";
                            e.target.style.boxShadow =
                              "0 0 0 3px rgba(34, 197, 94, 0.1)";
                          },
                          onBlur: (e) => {
                            e.target.style.borderColor = "rgb(203 213 225)";
                            e.target.style.boxShadow = "none";
                          },
                          onMouseEnter: (e) => {
                            if (document.activeElement !== e.target) {
                              e.target.style.borderColor = "rgb(148 163 184)";
                            }
                          },
                          onMouseLeave: (e) => {
                            if (document.activeElement !== e.target) {
                              e.target.style.borderColor = "rgb(203 213 225)";
                            }
                          },
                        }}
                        positionFixed={true}
                      />
                    </>
                  )}
                </div>
              )}
              {form.mode_of_payment === "cheque" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cheque Number
                  </label>
                  <input
                    type="text"
                    name="cheque_number"
                    value={form.cheque_number}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all hover:border-slate-400"
                    placeholder="Enter cheque number..."
                  />
                </div>
              )}
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
                className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all resize-none hover:border-slate-400"
              />
            </div>
          </div>

          {/* Add Items Section */}
          <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 px-6 py-3.5 border-t-2 border-b-2 border-green-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-4 h-4 text-green-600" />
              Add Items
            </h2>
            <button
              onClick={handleOpenMemoDrawer}
              className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline font-medium cursor-pointer text-left"
            >
              View Memos
            </button>
          </div>

          <div className="p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Expense <span className="text-red-500">*</span>
                </label>
                <Typeahead
                  ref={productTypeaheadRef}
                  id="expense-item-typeahead"
                  labelKey={(option) => `${option.name} (${option.code})`}
                  options={expenseList}
                  placeholder="Select expense item..."
                  onChange={(selectedItems) => {
                    if (selectedItems && selectedItems.length > 0) {
                      const expense = selectedItems[0];
                      setCurrentItem((prev) => ({
                        ...prev,
                        item_name: expense.name || "",
                        head: expense.code || "",
                        item_type: expense.chart_code || "",
                      }));
                    } else {
                      // Clear selection when user deselects
                      setCurrentItem((prev) => ({
                        ...prev,
                        item_name: "",
                        head: "",
                        item_type: "",
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
                      <div className="font-semibold text-slate-800">
                        {option.code} {option.name}
                      </div>
                      {option.account_type && (
                        <small className="text-slate-600 text-xs">
                          Type: {option.account_type}
                        </small>
                      )}
                    </div>
                  )}
                  inputProps={{
                    style: {
                      width: "100%",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      lineHeight: "1.25rem",
                      border: "2px solid rgb(203 213 225)",
                      borderRadius: "0.5rem",
                      transition: "all 0.15s ease-in-out",
                    },
                    onFocus: (e) => {
                      e.target.style.outline = "none";
                      e.target.style.borderColor = "rgb(34 197 94)";
                      e.target.style.boxShadow =
                        "0 0 0 3px rgba(34, 197, 94, 0.1)";
                    },
                    onBlur: (e) => {
                      e.target.style.borderColor = "rgb(203 213 225)";
                      e.target.style.boxShadow = "none";
                    },
                    onMouseEnter: (e) => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = "rgb(148 163 184)";
                      }
                    },
                    onMouseLeave: (e) => {
                      if (document.activeElement !== e.target) {
                        e.target.style.borderColor = "rgb(203 213 225)";
                      }
                    },
                  }}
                  positionFixed={true}
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
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={currentItem.quantity || ""}
                  onChange={handleItemChange}
                  placeholder="0"
                  className="text-center w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Unit Cost <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="cost"
                  value={currentItem.cost || ""}
                  onChange={handleItemChange}
                  placeholder="0.00"
                  step="0.01"
                  className="text-right w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Total
                </label>
                <div className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg bg-white text-slate-800 font-semibold text-right">
                  {formatNumber(currentItem.total)}
                </div>
              </div>

              <div className="md:col-span-1 flex items-end">
                <label className="flex items-center gap-2 cursor-pointer w-full px-3 py-2 border-2 border-slate-300 rounded-lg bg-white hover:border-slate-400 transition-all">
                  <input
                    type="checkbox"
                    name="taxable"
                    checked={currentItem.taxable || false}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        taxable: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-[var(--aa-accent)] focus:ring-2"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Mark as Taxable
                  </span>
                </label>
              </div>

              <div className="md:col-span-1">
                {editingItem ? (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEditedItem}
                      className="flex-1 px-3 py-2 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={addItem}
                    className="w-full px-3 py-2 mt-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
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
                          Expense Head
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                          Description
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-slate-700">
                          <span className="flex items-center justify-center gap-1">
                            Taxable
                          </span>
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
                              id={`expense-item-typeahead-${item._id}`}
                              labelKey={(option) =>
                                `${option.name} (${option.code})`
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
                                            item_type: expense.chart_code || "",
                                          }
                                        : i,
                                    ),
                                  );
                                } else {
                                  setItems(
                                    items.map((i) =>
                                      i._id === item._id
                                        ? {
                                            ...i,
                                            item_name: "",
                                            head: "",
                                            item_type: "",
                                          }
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
                                  <div className="font-semibold text-slate-800">
                                    {option.code} {option.name}
                                  </div>
                                  {option.account_type && (
                                    <small className="text-slate-600 text-xs">
                                      Type: {option.account_type}
                                    </small>
                                  )}
                                </div>
                              )}
                              inputProps={{
                                style: {
                                  width: "100%",
                                  padding: "0.375rem 0.5rem",
                                  fontSize: "0.75rem",
                                  lineHeight: "1rem",
                                  border: "1px solid rgb(203 213 225)",
                                  borderRadius: "0.375rem",
                                  transition: "all 0.15s ease-in-out",
                                },
                                onFocus: (e) => {
                                  e.target.style.outline = "none";
                                  e.target.style.borderColor = "rgb(34 197 94)";
                                  e.target.style.boxShadow =
                                    "0 0 0 2px rgba(34, 197, 94, 0.1)";
                                },
                                onBlur: (e) => {
                                  e.target.style.borderColor =
                                    "rgb(203 213 225)";
                                  e.target.style.boxShadow = "none";
                                },
                                onMouseEnter: (e) => {
                                  if (document.activeElement !== e.target) {
                                    e.target.style.borderColor =
                                      "rgb(148 163 184)";
                                  }
                                },
                                onMouseLeave: (e) => {
                                  if (document.activeElement !== e.target) {
                                    e.target.style.borderColor =
                                      "rgb(203 213 225)";
                                  }
                                },
                              }}
                              positionFixed={true}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {item.description}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <label className="flex items-center justify-center cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={item.taxable || false}
                                onChange={(e) => {
                                  setItems(
                                    items.map((i) =>
                                      i._id === item._id
                                        ? { ...i, taxable: e.target.checked }
                                        : i,
                                    ),
                                  );
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-[var(--aa-accent)] focus:ring-2 cursor-pointer"
                              />
                              {item.taxable && (
                                <span className="ml-2 text-xs text-green-600 font-medium">
                                  Taxable
                                </span>
                              )}
                            </label>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 text-center">
                            {formatNumber(item.quantity)}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 text-right">
                            {editingItem === item._id ? (
                              <input
                                type="number"
                                name="cost"
                                value={item.cost}
                                onChange={(e) => {
                                  const updatedCost = e.target.value;
                                  const updatedItems = items.map((i) =>
                                    i._id === item._id
                                      ? {
                                          ...i,
                                          cost: updatedCost,
                                          total:
                                            parseFloat(updatedCost || 0) *
                                            parseFloat(i.quantity || 0),
                                        }
                                      : i,
                                  );
                                  setItems(updatedItems);
                                }}
                                step="0.01"
                                className="text-right px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all hover:border-slate-400 bg-white w-full"
                              />
                            ) : (
                              "₦" + formatNumber(item.cost)
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
                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Package className="w-4 h-4 text-green-700" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        Grand Total
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-green-700">
                      ₦{formatNumber(calculateTotal())}
                    </span>
                  </div>
                </div>
              </div>
            )}
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
                      ₦{formatNumber(calculateTotal())}
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
                  onClick={handleDirectPurchase}
                  disabled={loading}
                  className="px-3 py-2.5 text-sm bg-[var(--aa-navy)] hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                  onClick={handleDirectPurchase}
                  disabled={loading}
                  className="px-3 py-2.5 text-sm bg-[var(--aa-navy)] hover:from-blue-700 hover:to-blue-800 text-white rounded-lg transition-all flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
            ) : memos.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No memos found</p>
                <p className="text-sm text-gray-500">
                  There are no available memos to add to the bill
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {memos.map((memo) => (
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
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                            {memo.status}
                          </span>
                        </div>
                        {memo.subject && (
                          <p className="text-sm text-gray-700 mb-2">
                            {memo.subject}
                          </p>
                        )}
                      </div>
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
                                  {item.reason && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {item.reason}
                                    </p>
                                  )}
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
                        onClick={() =>
                          handleCloseMemo(memo, { addItems: true })
                        }
                        className="w-full px-3 py-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white rounded-lg transition-colors font-medium text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          selectedMemoIds.includes(memo.memo_id) ||
                          closingMemoId === memo.memo_id
                        }
                      >
                        {closingMemoId === memo.memo_id
                          ? "Processing..."
                          : selectedMemoIds.includes(memo.memo_id)
                            ? "✓ Added & Closed"
                            : `Add & Close (${memo.item_count || 0} items)`}
                      </button>
                      <button
                        onClick={() =>
                          handleCloseMemo(memo, { addItems: false })
                        }
                        className="w-full px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-300 transition-colors font-medium text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={closingMemoId === memo.memo_id}
                      >
                        {closingMemoId === memo.memo_id
                          ? "Closing..."
                          : "Close Memo (don’t add items)"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
