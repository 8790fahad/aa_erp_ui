import { formatNumber1 } from "@/components/router/utilities";
import { _postApi } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  Eye,
  X,
  Plus,
  Trash2,
  FileText,
  Search,
  ClipboardList,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalHeader } from "reactstrap";
import { toast } from "sonner";
import SearchSupplierInput from "./SearchSuppliers";
import PurchaseRequisitionAPI from "./purchaseRequisitionApi";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Skeleton } from "@/components/ui/skeleton";
import PurchaseOrderNav from "./PurchaseOrderNav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const poInputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";
const poLabelClass = "mb-1.5 block text-xs font-medium text-slate-600";

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "pending payment") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "pending") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

export default function PurchaseRequisitionList() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const isHistory = searchParams.get("tab") === "history";
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);

  // Form modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [formItems, setFormItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({
    item: "",
    quantity: "",
    uom: "",
    category: "",
    unit: "",
  });

  // Refs for focus management
  const productDescriptionRef = useRef(null);
  const quantityInputRef = useRef(null);
  const uomInputRef = useRef(null);

  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    requisitor: `${user.firstname} ${user.lastname}`,
    branch: user.branch_name,
    reason: "inventory topup",
  });

  const [errors, setErrors] = useState({
    reason: "",
    supplier: "",
  });

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const viewList = (item) => {
    toggle(item);
    _postApi(
      "/account/purchase/getPr",
      {
        query_type: "select-exp",
        pr_no: item.pr_no,
        facilityId: activeBusiness.id,
      },
      (res) => {
        if (res.success) {
          setItemList(res.results || []);
        }
      },
      (err) => {
        toast.error("Error Occurred");
        console.log(err);
      },
    );
  };

  const getPR = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _postApi(
      `/account/get-purchase-requisition`,
      {
        query_type: isHistory ? "select-history" : "select",
        requisitor: `${user.firstname} ${user.lastname}`,
        facilityId: activeBusiness.id,
      },
      (data) => {
        setLoading(false);
        if (data.success) {
          setPr(data.results || []);
        } else {
          toast.error(data.message || "Failed to load purchase orders");
          setPr([]);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
        toast.error(err?.message || "Failed to load purchase orders");
        setPr([]);
      },
    );
  }, [activeBusiness.id, user.firstname, user.lastname, isHistory]);

  useEffect(() => {
    getPR();
  }, [getPR]);

  // Form modal functions
  const openFormModal = () => {
    setForm({
      date: moment().format("YYYY-MM-DD"),
      requisitor: `${user.firstname} ${user.lastname}`,
      branch: user.branch_name,
      reason: "inventory topup",
      expenses: [],
      supplier_name: "",
      supplier_code: "",
      account_code: "",
    });
    setExpenses([]);
    setNewExpense({
      item: "",
      quantity: "",
      uom: "",
      category: "",
      unit: "",
    });
    setErrors({ reason: "", supplier: "" });
    getProductList();
    getCategories();
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
  };

  const handleFormSheetChange = (open) => {
    if (open) openFormModal();
    else closeFormModal();
  };

  // API calls for form
  const getProductList = useCallback(() => {
    if (!activeBusiness?.id) return;

    _postApi(
      "/inventory/product-list-3",
      {
        facilityId: activeBusiness.id,
      },
      (response) => {
        if (response.success) {
          // Format the items similar to PurchaseRequisitionAPI.getProductList
          const formattedItems = (response.results || []).map((item) => ({
            name: item.item_name,
            code: item.item_code,
            chart_code: item.chart_code,
            id: item.id,
            sku: item.sku,
            category: item.category,
            unit_of_measure: item.unit_of_measure,
            cost_price: item.cost_price,
            selling_price: item.selling_price,
          }));
          setFormItems(formattedItems);
        }
      },
      (err) => {
        console.error("Product List API Error:", err);
        toast.error("Something went wrong while fetching product data");
      }
    );
  }, [activeBusiness.id]);

  const getCategories = useCallback(async () => {
    if (!activeBusiness?.id) return;

    try {
      const response = await PurchaseRequisitionAPI.getCategories(
        activeBusiness.id
      );
      setCategories(response.data);
    } catch (error) {
      toast.error(error.message);
    }
  }, [activeBusiness.id]);

  // Form validation
  const validateForm = () => {
    const newErrors = {
      reason: "",
      supplier: "",
    };

    let isValid = true;

    if (!form.supplier_name || !form.supplier_code) {
      toast.error("Preferred vendor/supplier is required");
      newErrors.supplier = "Preferred vendor/supplier is required";
      isValid = false;
    }

    if (!form.reason) {
      toast.error("Reason for purchase is required");
      newErrors.reason = "Reason for purchase is required";
      isValid = false;
    }

    if (expenses.length === 0) {
      isValid = false;
      toast.error("Requisition details is required");
    }

    setErrors(newErrors);
    return isValid;
  };

  // Form handlers
  const handleFormChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleAddExpense = () => {
    if (newExpense.item && newExpense.quantity && newExpense.uom) {
      setExpenses((prev) => [...prev, newExpense]);
      setNewExpense({
        item: "",
        quantity: "",
        uom: "",
        category: "",
        unit: "",
      });

      // Focus back on Product Description after adding
      setTimeout(() => {
        if (productDescriptionRef.current) {
          // Clear typeahead selection + input, then focus
          productDescriptionRef.current.clear();
          const input = productDescriptionRef.current.getInput();
          if (input) input.focus();
        }
      }, 100);
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const applyProductToDraft = (selected) => {
    if (!selected) {
      setNewExpense((prev) => ({
        ...prev,
        item: "",
        item_code: "",
        chart_code: "",
        subhead: "",
      }));
      return;
    }
    const unitOfMeasure = selected.unit_of_measure || "";
    const categoryObj = categories?.find((cat) =>
      cat.units?.includes(unitOfMeasure),
    );
    setNewExpense((prev) => ({
      ...prev,
      item: selected.name || "",
      item_code: selected.code || "",
      chart_code: selected.chart_code || "",
      subhead: selected.subhead || "",
      uom: unitOfMeasure || prev.uom || "",
      unit: unitOfMeasure || prev.unit || "",
      unit_code: unitOfMeasure || prev.unit_code || "",
      category: categoryObj?.category || prev.category || "",
      category_code: categoryObj?.category || prev.category_code || "",
      quantity: prev.quantity || 1,
    }));
  };

  const updateExpenseField = (index, updates) => {
    setExpenses((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...updates } : row)),
    );
  };

  const handleDeleteExpense = (index) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitForm = async () => {
    if (!validateForm()) {
      return;
    }

    if (expenses.length === 0) {
      toast.error("Please add at least one expense before submitting.");
      return;
    }

    setFormLoading(true);

    try {
      const requisitionData = {
        ...form,
        prefix: activeBusiness.prefix,
        expenses,
        user_id: user.id,
      };

      const response = await PurchaseRequisitionAPI.submitPurchaseRequisition(
        requisitionData
      );
      toast.success(response.message);

      // Close modal and refresh list
      setIsFormModalOpen(false);
      getPR();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setFormLoading(false);
    }
  };

  const filteredPr = (pr || []).filter((row) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      String(row.branch || "")
        .toLowerCase()
        .includes(q) ||
      String(row.pr_no || "")
        .toLowerCase()
        .includes(q) ||
      String(row.reason || "")
        .toLowerCase()
        .includes(q) ||
      String(row.supplier_name || "")
        .toLowerCase()
        .includes(q)
    );
  });
  return (
    <>
      <div className="h-fit w-full">
        <div className="mx-auto h-fit max-w-7xl">
          <div className="h-fit overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
                  <ClipboardList className="h-5 w-5 text-[var(--aa-accent)]" />
                  Purchase Orders
                </h1>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isHistory
                    ? "Past purchase orders and requisitions"
                    : "Create and track purchase requisitions pending approval"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search PR, supplier, subject…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 w-56 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                  />
                </div>
                {!isHistory && (
                  <Button
                    onClick={openFormModal}
                    className="h-9 gap-1.5 bg-[var(--aa-accent)] text-white hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" />
                    Create Purchase Order
                  </Button>
                )}
              </div>
            </div>

            <PurchaseOrderNav />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">PR No.</th>
                    <th className="px-4 py-2.5 font-medium">Subject</th>
                    <th className="px-4 py-2.5 font-medium">Supplier</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-4 py-3" colSpan={6}>
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredPr.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-16 text-center text-slate-500"
                      >
                        <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        {isHistory
                          ? "No purchase order history yet"
                          : "No purchase orders to show"}
                      </td>
                    </tr>
                  ) : (
                    filteredPr.map((row) => (
                      <tr
                        key={row.pr_no}
                        className="border-b border-slate-100/80 bg-white hover:bg-slate-50/60"
                      >
                        <td className="whitespace-nowrap bg-white px-4 py-2.5 tabular-nums text-slate-600">
                          {row.date
                            ? moment(row.date).format("DD MMM YYYY")
                            : "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5 font-mono text-[13px] font-semibold text-slate-800">
                          {row.pr_no}
                        </td>
                        <td className="max-w-[220px] truncate bg-white px-4 py-2.5 text-slate-700">
                          {row.reason || "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5 text-slate-700">
                          {row.supplier_name || "—"}
                        </td>
                        <td className="bg-white px-4 py-2.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                              row.status,
                            )}`}
                          >
                            {row.status || "—"}
                          </span>
                        </td>
                        <td className="bg-white px-4 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewList(row)}
                            className="h-8 text-[var(--aa-accent)] hover:bg-slate-100"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

        <Modal isOpen={isOpen} toggle={toggle} size="lg">
          <ModalHeader toggle={toggle}>View purchase order</ModalHeader>
          {/* {JSON.stringify(items)} */}
          <ModalBody>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{ display: "flex", flexDirection: "row", width: "100%" }}
              >
                <div style={{ flexDirection: "row", width: "100%" }}>
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 12,
                      textTransform: "uppercase",
                      marginRight: 10,
                    }}
                  >
                    Date: <b>{moment().format(items?.date)}</b>
                  </div>
                </div>
                <div style={{ flexDirection: "row", width: "100%" }}>
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 12,
                      textTransform: "uppercase",
                      marginRight: 10,
                      textAlign: "right",
                    }}
                  >
                    PR No.: <b>{items?.pr_no}</b>
                  </div>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  From branch: <b>{items?.branch}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 12,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Requisitor: <b>{items?.requisitor}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Reason of purchase: <b>{items?.reason}</b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Supplier Name:{" "}
                  <b>
                    {items?.supplier_name}({items?.supplier_code})
                  </b>
                </div>
              </div>
              <div style={{ flexDirection: "row", width: "100%" }}>
                <div
                  style={{
                    marginBottom: 10,
                    fontSize: 14,
                    textTransform: "uppercase",
                    marginRight: 10,
                  }}
                >
                  Details: <br />
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th className="text-center">S/N</th>
                        <th className="text-center">Item Name</th>
                        <th className="text-center">Quantity </th>
                        {/* <th className="text-center">Unit Category</th> */}
                        <th className="text-center">Unit of Measure</th>
                        {/* <th className="text-center">Unit Cost (₦)</th>
                        <th className="text-center">Total Cost (₦)</th> */}
                      </tr>
                    </thead>
                    <tbody>
                      {/* {JSON.stringify(itemList)} */}
                      {itemList?.map((item, idx) => (
                        <tr key={item.item_list_id || item.id || idx}>
                          <td>{idx + 1}</td>
                          <td>{item?.item_name}</td>
                          <td className="text-center">
                            {formatNumber1(item?.quantity)}
                          </td>
                          {/* <td className="text-center">{item?.unit_category}</td> */}
                          <td className="text-center">{item?.unit_measure}</td>
                          {/* <td className="text-right">
                            {formatNumber1(item?.est_cost)}
                          </td> */}
                          {/* <td className="text-right">
                            {formatNumber1(item?.est_cost * item?.quantity)}
                          </td> */}
                        </tr>
                      ))}
                      {/* <tr>
                        <td colSpan={6} className="text-right fw-bold">
                          Total:
                        </td>
                        <td className="text-right">
                          {formatNumber1(items?.total)}
                        </td>
                      </tr> */}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </ModalBody>
        </Modal>
      {/* Create Purchase Order — right sheet */}
      <Sheet open={isFormModalOpen} onOpenChange={handleFormSheetChange}>
        <SheetContent
          side="right"
          className="!inset-y-0 !right-0 !left-auto flex h-full w-full max-w-full flex-col gap-0 overflow-hidden border-l border-slate-200 p-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:!max-w-xl md:!max-w-2xl lg:!max-w-3xl"
        >
          <SheetHeader className="shrink-0 space-y-1 border-b border-slate-200 bg-[var(--aa-navy)] px-5 py-4 text-left pr-12">
            <SheetTitle className="text-lg font-semibold text-white">
              Create Purchase Order
            </SheetTitle>
            <SheetDescription className="text-sm text-white/70">
              Add items and details for your purchase order
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div>
                <label htmlFor="po-date" className={poLabelClass}>
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="po-date"
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleFormChange}
                  className={poInputClass}
                />
              </div>

              <div>
                <label className={poLabelClass}>
                  Preferred vendor / supplier{" "}
                  <span className="text-red-500">*</span>
                </label>
                <SearchSupplierInput
                  label=""
                  edge
                  placeholder="Search and select supplier..."
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "0.375rem",
                  }}
                  inputProps={{
                    className:
                      "h-9 !border-0 !shadow-none !outline-none focus:!ring-0 text-sm",
                    style: {
                      boxShadow: "none",
                    },
                  }}
                  className="[&_.rbt-input-main]:!border-0 [&_.form-control]:h-9 [&_.form-control]:text-sm [&_.form-control]:shadow-none [&:focus-within]:!border-[var(--aa-accent)] [&:focus-within]:!ring-1 [&:focus-within]:!ring-[var(--aa-accent)]"
                  onChange={(s) => {
                    setForm((p) => ({
                      ...p,
                      supplier_name: s?.supplier_name || "",
                      supplier_code: s?.supplier_number || "",
                      account_code: s?.supplier_subhead || "",
                    }));
                    setErrors((prev) => ({ ...prev, supplier: "" }));
                  }}
                />
                {errors.supplier && (
                  <p className="mt-1 text-xs text-red-500">{errors.supplier}</p>
                )}
              </div>

              <div>
                <label htmlFor="po-reason" className={poLabelClass}>
                  Reason for purchase <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="po-reason"
                  name="reason"
                  value={form.reason}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Why is this purchase needed?"
                  className={`${poInputClass} h-auto min-h-[5.5rem] py-2 ${
                    errors.reason ? "border-red-500" : ""
                  }`}
                />
                {errors.reason && (
                  <p className="mt-1 text-xs text-red-500">{errors.reason}</p>
                )}
              </div>

              <div className="-mx-5 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-5 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Line Items
                  </p>
                  <span className="text-xs text-slate-500">
                    {expenses.length} line
                    {expenses.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="w-full overflow-x-auto px-2 sm:px-3">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                        <th className="min-w-[220px] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                          Item Details
                        </th>
                        <th className="w-24 px-2 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                          Quantity
                        </th>
                        <th className="w-28 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
                          UoM
                        </th>
                        <th className="w-10 px-1 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {expenses.map((expense, index) => (
                        <tr
                          key={`${expense.item_code || expense.item}-${index}`}
                          className="bg-white hover:bg-slate-50/80"
                        >
                          <td className="px-3 py-3 align-top">
                            <div className="text-sm font-medium text-slate-900">
                              {expense.item}
                            </div>
                            {expense.item_code ? (
                              <div className="mt-0.5 text-xs text-slate-500">
                                {expense.item_code}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-2 py-3 align-top text-right">
                            <input
                              type="number"
                              min="1"
                              value={expense.quantity || ""}
                              onChange={(e) =>
                                updateExpenseField(index, {
                                  quantity: Number(e.target.value),
                                })
                              }
                              className="ml-auto w-20 rounded border border-slate-300 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                            />
                          </td>
                          <td className="px-2 py-3 align-top">
                            <input
                              type="text"
                              value={expense.uom || expense.unit || ""}
                              onChange={(e) => {
                                const uomValue = e.target.value;
                                const categoryObj = categories?.find((cat) =>
                                  cat.units?.includes(uomValue),
                                );
                                updateExpenseField(index, {
                                  uom: uomValue,
                                  unit: uomValue,
                                  unit_code: uomValue,
                                  category: categoryObj?.category || "",
                                  category_code: categoryObj?.category || "",
                                });
                              }}
                              className="w-full min-w-[5rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                            />
                          </td>
                          <td className="px-1 py-3 text-center align-top">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(index)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Remove line"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Empty / add row — same pattern as invoice item table */}
                      <tr className="bg-white hover:bg-slate-50/80">
                        <td className="px-3 py-3 align-top">
                          <TypeaheadCustom
                            _ref={productDescriptionRef}
                            options={formItems}
                            placeholder="Search and select product..."
                            labelKey={(item) =>
                              `${item.name} (${item.code})`
                            }
                            onChange={(selectedItems) => {
                              applyProductToDraft(
                                selectedItems.length
                                  ? selectedItems[0]
                                  : null,
                              );
                              if (selectedItems.length) {
                                setTimeout(() => {
                                  quantityInputRef.current?.focus();
                                  quantityInputRef.current?.select();
                                }, 100);
                              }
                            }}
                            selected={
                              newExpense.item
                                ? formItems.filter(
                                    (item) => item.name === newExpense.item,
                                  )
                                : []
                            }
                            renderMenuItemChildren={(option) => (
                              <div className="py-1">
                                <div className="text-sm font-medium text-slate-800">
                                  {option.name}
                                </div>
                                <div className="mt-0.5 text-xs text-slate-500">
                                  {option.code}
                                </div>
                              </div>
                            )}
                            fixed={true}
                            flip={true}
                          />
                        </td>
                        <td className="px-2 py-3 align-top text-right">
                          <input
                            ref={quantityInputRef}
                            type="number"
                            min="1"
                            value={newExpense.quantity || ""}
                            placeholder="0"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (!newExpense.uom) {
                                  uomInputRef.current?.focus();
                                  return;
                                }
                                handleAddExpense();
                              }
                            }}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                quantity: Number(e.target.value),
                              })
                            }
                            className="ml-auto w-20 rounded border border-slate-300 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <input
                            ref={uomInputRef}
                            type="text"
                            value={newExpense.uom || ""}
                            placeholder="kg, pcs…"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddExpense();
                              }
                            }}
                            onChange={(e) => {
                              const uomValue = e.target.value;
                              const categoryObj = categories?.find((cat) =>
                                cat.units?.includes(uomValue),
                              );
                              setNewExpense({
                                ...newExpense,
                                uom: uomValue,
                                unit: uomValue,
                                unit_code: uomValue,
                                category: categoryObj?.category || "",
                                category_code: categoryObj?.category || "",
                              });
                            }}
                            className="w-full min-w-[5rem] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                          />
                        </td>
                        <td className="px-1 py-3 text-center align-top">
                          <button
                            type="button"
                            onClick={handleAddExpense}
                            disabled={
                              !newExpense.item ||
                              !newExpense.quantity ||
                              !newExpense.uom
                            }
                            className="rounded p-1 text-[var(--aa-accent)] hover:bg-slate-100 disabled:opacity-40"
                            title="Add line"
                          >
                            <Plus size={14} />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          newExpense.item &&
                          newExpense.quantity &&
                          newExpense.uom
                        ) {
                          handleAddExpense();
                        } else {
                          productDescriptionRef.current
                            ?.getInput?.()
                            ?.focus();
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-[var(--aa-accent)] hover:bg-slate-50"
                    >
                      <Plus size={14} />
                      Add New Row
                    </button>
                    {expenses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpenses([])}
                        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Clear all lines
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeFormModal}
                disabled={formLoading}
                className="h-9"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitForm}
                className="h-9 bg-[var(--aa-accent)] text-white hover:opacity-90"
                disabled={expenses.length === 0 || formLoading}
              >
                {formLoading ? "Submitting…" : "Submit Purchase Order"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
