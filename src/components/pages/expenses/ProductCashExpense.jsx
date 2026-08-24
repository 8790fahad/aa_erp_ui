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
  Loader,
  Edit2,
  Check,
  ChevronLeft,
  Printer,
  Users,
} from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { getSuppliers } from "@/redux/actions/suppliers";
import { Typeahead } from "react-bootstrap-typeahead";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import useQuery from "@/hooks/useQuery";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const initialItemForm = {
  item_name: "",
  sku: "",
  quantity: "",
  cost: "",
  total: 0,
  item_type: "",
};

export default function ProductCashExpense() {
  const query = useQuery();
  const type = query.get("type");
  const productTypeaheadRef = useRef();
  const dispatch = useDispatch();
  const { supplierList } = useSelector((d) => d.suppliers) || [];
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const today = moment().format("YYYY-MM-DD");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: today,
    supplier_name: "",
    supplier_number: "",
    supplier_code: "",
    supplier_subhead: "",
    remark: "",
    mode_of_payment: "",
    cheque_number: "",
  });

  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(initialItemForm);
  const [loading, setLoading] = useState(false);
  const [productList, setProductList] = useState([]);
  const [accountList, setAccountList] = useState([]);
  const [bankAccount, setBankAccount] = useState({});
  const [headList, setHeadList] = useState([]);
  const [accountHead, setAccountHead] = useState({});
  const hasAutoSelectedSupplier = useRef(false);
  const cashAccountTypeaheadRef = useRef();

  // Editing state
  const [editingItem, setEditingItem] = useState(null);

  // Requisitions drawer state
  const [isRequisitionsDrawerOpen, setIsRequisitionsDrawerOpen] =
    useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [loadingRequisitions, setLoadingRequisitions] = useState(false);
  const [selectedRequisitionIds, setSelectedRequisitionIds] = useState([]);

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
      !currentItem.cost ||
      !currentItem.item_type
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

  const handleDirectPurchase = (printAfterSave = false) => {
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

    if (!form.mode_of_payment) {
      toast.error("Please select mode of payment");
      return;
    }

    // Prepare purchase data with items
    const purchaseData = items.map((item) => ({
      ...item,
      item_code: item.sku,
      cost: item.cost,
      qty: item.quantity,
    }));

    setLoading(true);

    // Save purchase to stock
    _postApi(
      `/account/direct-consumables`,
      {
        data: purchaseData,
        facilityId: activeBusiness._id,
        payable_code: activeBusiness.payable_code,
        supplier_advance: activeBusiness.payable_accural_code,
        user_id: user.id,
        supplier_no: form.supplier_number,
        remark: form.remark,
        transaction_date: form.date,
        bankAccount,
        accountHead,
        mode_of_payment: form.mode_of_payment,
      },
      (res) => {
        if (res.success) {
          toast.success(res.message || "Purchase recorded successfully");
          setLoading(false);

          // Navigate to print page if shouldPrint is true
          if (printAfterSave) {
            // The API returns reference in the data object
            const invoiceRef =
              res.data?.reference ||
              res.data?.invoice_ref ||
              res.invoice_ref ||
              res.data?.ref_number ||
              res.ref_number;

            if (invoiceRef) {
              navigate(
                `/app/expenses/cash-expenses/product-cash-expense-pdf?invoice_ref=${invoiceRef}&mode_of_payment=${form.mode_of_payment}`
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
                  `/app/expenses/cash-expenses/product-cash-expense-pdf?invoice_ref=${transactionRef}&mode_of_payment=${form.mode_of_payment}`
                );
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
        }
      },
      (err) => {
        toast.error(err.message);
        console.error(err);
        setLoading(false);
      }
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
      return;
    }

    // Map the items from the requisition to the format expected by the items list
    const requisitionItems = requisition.items.map((item) => ({
      _id: uuidv4(),
      item_name: item.item_name || "",
      sku: item.item_code || "",
      quantity: item.quantity || 1,
      cost: item.unit_cost || item.cost || 0,
      total:
        parseFloat(item.quantity || 1) *
        parseFloat(item.unit_cost || item.cost || 0),
      item_type: item.item_type || "",
    }));

    // Add to items list
    setItems([...items, ...requisitionItems]);

    // Populate Select Supplier when requisition has supplier details
    // Note: Purchase Requisition stores supplier_number in supplier_code field
    const supplierNo =
      requisition.supplier_number ||
      requisition.supplier_no ||
      requisition.supplier_code;
    if (requisition.supplier_name || supplierNo) {
      setForm((prev) => ({
        ...prev,
        supplier_name: requisition.supplier_name || prev.supplier_name,
        supplier_code: requisition.supplier_code || prev.supplier_code,
        supplier_number: supplierNo || prev.supplier_number,
        supplier_subhead:
          requisition.supplier_subhead ||
          requisition.account_code ||
          prev.supplier_subhead,
      }));
    }

    // Add requisition ID to selected list to prevent re-adding
    if (!selectedRequisitionIds.includes(requisition.pr_no)) {
      setSelectedRequisitionIds((prev) => [...prev, requisition.pr_no]);
    }

    toast.success(
      `Added ${requisitionItems.length} item(s) from requisition ${requisition.pr_no}`
    );
  };

  useEffect(() => {
    dispatch(getSuppliers());
    getProducts();
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
        }
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
        }
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
        {/* {JSON.stringify(bankAccount)} */}
        {/* Header */}
        {/* <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  Direct Purchase
                </h1>
                <p className="text-sm text-slate-600">
                  Create and record direct purchase transactions
                </p>
              </div>
            </div>
          </div>
        </div> */}

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
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Product Expense
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
                  className="w-full px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all bg-white hover:border-slate-400"
                >
                  <option value="">Select supplier...</option>
                  {/* Show requisition's supplier when added but not yet in supplierList */}
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
                            (account) => account.id === Number(e.target.value)
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
                                (cash) => cash.head === accountHead.head
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
            </div>

            {form.mode_of_payment === "cheque" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cheque Number
                </label>
                <input
                  type="text"
                  name="cheque_number"
                  value={form.cheque_number}
                  onChange={handleFormChange}
                  className="w-full md:w-1/3 px-3 py-2 text-sm border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] transition-all hover:border-slate-400"
                  placeholder="Enter cheque number..."
                />
              </div>
            )}

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
              onClick={handleOpenRequisitionsDrawer}
              className="text-[var(--aa-accent)] hover:text-[var(--aa-accent-hover)] hover:underline font-medium cursor-pointer text-left"
            >
              View Purchase Orders
            </button>
          </div>

          <div className="p-6 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 items-end">
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                <Typeahead
                  ref={productTypeaheadRef}
                  id="product-typeahead"
                  labelKey={(item) => item.name + " - " + item.sku}
                  options={productList}
                  placeholder="Search product..."
                  onChange={(selected) => {
                    if (selected.length) {
                      const product = selected[0];
                      const cost = product.cost_price || "";
                      const quantity = currentItem.quantity || 0;
                      const total = parseFloat(cost) * parseFloat(quantity);

                      setCurrentItem((prev) => ({
                        ...prev,
                        item_name: product.name,
                        sku: product.sku,
                        cost: cost,
                        item_type: product.item_type,
                        total: total || 0,
                      }));
                    } else {
                      // Clear selection when user deselects
                      setCurrentItem((prev) => ({
                        ...prev,
                        item_name: "",
                        sku: "",
                        item_type: "",
                      }));
                    }
                  }}
                  selected={
                    currentItem.item_name && currentItem.sku
                      ? productList.filter(
                          (product) =>
                            product.sku === currentItem.sku &&
                            product.name === currentItem.item_name
                        )
                      : []
                  }
                  clearButton
                  renderMenuItemChildren={(option) => (
                    <div className="py-1">
                      <div className="font-semibold text-slate-800">
                        {option.sku} {option.name}
                      </div>
                      <small className="text-slate-600 text-xs">
                        Type: {option.item_type}{" "}
                      </small>
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

              <div className="md:col-span-2">
                {editingItem ? (
                  <div className="flex gap-1">
                    <button
                      onClick={saveEditedItem}
                      className="flex-1 px-2 py-2 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white rounded-lg transition-all flex items-center justify-center gap-1 font-medium shadow-md hover:shadow-lg"
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
                  <button
                    onClick={addItem}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 font-medium shadow-md hover:shadow-lg"
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
                          Item Name
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
                          <td className="px-3 py-2 text-xs font-medium text-slate-800">
                            {item.item_name}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 text-right">
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
                                      : i
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
                  onClick={() => handleDirectPurchase(true)}
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
                  onClick={() => handleDirectPurchase(false)}
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

      {/* Requisitions Drawer */}
      <Drawer
        open={isRequisitionsDrawerOpen}
        onOpenChange={setIsRequisitionsDrawerOpen}
      >
        <DrawerContent
          side="right"
          className="bg-white border-gray-200 flex flex-col h-full !w-[600px] max-w-[600px]"
        >
          <DrawerHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-gray-900 text-xl">
                  Approved Purchase Requisitions
                </DrawerTitle>
                <DrawerDescription className="text-gray-600 mt-1">
                  Click "Add to List" button to add requisition items
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  onClick={() => {
                    setSelectedRequisitionIds([]);
                  }}
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loadingRequisitions ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">
                  Loading requisitions...
                </span>
              </div>
            ) : requisitions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  No approved requisitions found
                </p>
                <p className="text-sm text-gray-500">
                  There are no approved purchase requisitions available
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requisitions.map((requisition) => (
                  <div
                    key={requisition.pr_no || requisition._id}
                    className={`bg-white border-2 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all ${
                      selectedRequisitionIds.includes(requisition.pr_no)
                        ? "opacity-50 cursor-not-allowed border-green-400 bg-green-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-bold text-gray-900">
                            {requisition.pr_no}
                          </h3>
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                            {requisition.status}
                          </span>
                        </div>
                        {requisition.reason && (
                          <p className="text-sm text-gray-700 mb-2">
                            {requisition.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                      {requisition.date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {moment(requisition.date).format("MMM DD, YYYY")}
                          </span>
                        </div>
                      )}
                      {(requisition.supplier_name ||
                        requisition.supplier_number ||
                        requisition.supplier_code) && (
                        <div className="flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          <span className="truncate font-medium">
                            {requisition.supplier_name ||
                              requisition.supplier_number ||
                              requisition.supplier_code}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Items section - now always visible since items are included in the API response */}
                    {requisition.items && requisition.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="space-y-2">
                          {requisition.items.slice(0, 3).map((item, index) => (
                            <div
                              key={item.id || index}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-2 pl-3"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    {item.item_name} {item.unit_measure}
                                  </h4>
                                  <p className="text-xs text-gray-600">
                                    {item.item_code}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900">
                                    Qty: {item.quantity || 1}
                                  </div>
                                  {/* <div className="text-xs text-gray-600">
                                    ₦
                                    {formatNumber(
                                      item.unit_cost || item.cost || 0
                                    )}
                                  </div> */}
                                </div>
                              </div>
                            </div>
                          ))}
                          {requisition.items.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              + {requisition.items.length - 3} more items
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 space-y-2">
                      <button
                        onClick={() => {
                          addRequisitionItems(requisition);
                          setIsRequisitionsDrawerOpen(false);
                        }}
                        className="w-full px-3 py-1 bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white rounded-lg transition-colors font-medium text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedRequisitionIds.includes(
                          requisition.pr_no
                        )}
                      >
                        {selectedRequisitionIds.includes(requisition.pr_no)
                          ? "✓ Added to List"
                          : `Add to List (${requisition.item_count || 0} items)`}
                      </button>
                      <button
                        onClick={() => {
                          addRequisitionItems(requisition);
                          setIsRequisitionsDrawerOpen(false);
                        }}
                        className="w-full px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={selectedRequisitionIds.includes(
                          requisition.pr_no
                        )}
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
    </div>
  );
}
