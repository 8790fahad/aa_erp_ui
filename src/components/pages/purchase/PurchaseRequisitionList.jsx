import { formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
} from "@/utilities";
import { _postApi, _fetchApi, apiURL } from "@/redux/actions/api";

import moment from "moment";
import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  FileText,
  Search,
  ClipboardList,
  Upload,
  Paperclip,
  ExternalLink,
  Loader2,
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
import PurchaseOrderNav, {
  usePurchaseOrderPermissions,
} from "./PurchaseOrderNav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const MAX_PO_FILE_BYTES = 25 * 1024 * 1024;
const PO_ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const PO_ALLOWED_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "docx"]);

function isAllowedPoFile(file) {
  if (file?.type && PO_ALLOWED_TYPES.has(file.type)) return true;
  const ext = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase();
  return PO_ALLOWED_EXTS.has(ext);
}

function attachmentHref(doc) {
  if (doc?.url && /^https?:\/\//i.test(doc.url)) return doc.url;
  if (doc?.file_path) return `${apiURL}/public/uploads/${doc.file_path}`;
  return null;
}

const poInputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";
const poLabelClass = "mb-1.5 block text-xs font-medium text-slate-600";
const poQtyInputClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]";

function formatAmountInput(value) {
  const withoutCommas = String(value || "").replace(/,/g, "");
  const sanitized = filterJournalAmountInput(withoutCommas);
  const parts = sanitized.split(".");
  const numericValue =
    parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : sanitized;
  return formatNumberWithCommas(numericValue);
}

function displayFormattedAmount(value) {
  if (value === "" || value == null) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return formatNumberWithCommas(String(value));
  }
  return String(value);
}

function parseQty(value) {
  return parseFloat(parseNumberFromFormatted(value)) || 0;
}

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
  const { canCreate } = usePurchaseOrderPermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const [itemList, setItemList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState({});
  const [pr, setPr] = useState([]);

  // Form modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [viewAttachments, setViewAttachments] = useState([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const attachmentInputRef = useRef(null);
  const [allBranches, setAllBranches] = useState([]);

  // Form state
  const [formItems, setFormItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allMeasures, setAllMeasures] = useState([]);
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

  /** Branch ids assigned to the logged-in staff. */
  const userBranchIds = useMemo(() => {
    if (Array.isArray(user?.branchIds) && user.branchIds.length > 0) {
      return user.branchIds.map(Number).filter(Boolean);
    }
    if (Array.isArray(user?.branches) && user.branches.length > 0) {
      return user.branches
        .map((b) => Number(b.id || b.branch_id))
        .filter(Boolean);
    }
    if (user?.branchId) return [Number(user.branchId)];
    return [];
  }, [user?.branchIds, user?.branches, user?.branchId]);

  /** Warehouses the user can pick — only their assigned branches. */
  const warehouseOptions = useMemo(() => {
    const mapped = (allBranches || []).map((b) => ({
      id: Number(b.id || b.branch_id),
      branch_name: b.branch_name || b.storeName || "",
    }));
    if (!userBranchIds.length) return mapped.filter((b) => b.id && b.branch_name);
    return mapped.filter(
      (b) => b.id && b.branch_name && userBranchIds.includes(b.id),
    );
  }, [allBranches, userBranchIds]);

  const defaultWarehouse = useMemo(() => {
    if (!warehouseOptions.length) return { branch_id: "", branch: "" };
    const preferredId = user?.branchId ? Number(user.branchId) : null;
    const match =
      (preferredId &&
        warehouseOptions.find((b) => b.id === preferredId)) ||
      warehouseOptions.find(
        (b) =>
          b.branch_name &&
          user?.branch_name &&
          String(b.branch_name).toLowerCase() ===
            String(user.branch_name).toLowerCase(),
      ) ||
      warehouseOptions[0];
    return {
      branch_id: match?.id ? String(match.id) : "",
      branch: match?.branch_name || "",
    };
  }, [warehouseOptions, user?.branchId, user?.branch_name]);

  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    requisitor: `${user.firstname} ${user.lastname}`,
    branch: user.branch_name || "",
    branch_id: user.branchId ? String(user.branchId) : "",
    reason: "inventory topup",
  });

  const [errors, setErrors] = useState({
    reason: "",
    supplier: "",
    branch: "",
  });

  const toggle = (item) => {
    setItems(item);
    setIsOpen(!isOpen);
  };

  const viewList = (item) => {
    toggle(item);
    setViewAttachments([]);
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
    PurchaseRequisitionAPI.getPurchaseOrderDocuments(activeBusiness.id, {
      pr_no: item.pr_no,
      po_no: item.po_no,
    })
      .then((res) => setViewAttachments(res.data || []))
      .catch(() => setViewAttachments([]));
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

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res.success) setAllBranches(res.results || []);
        else setAllBranches([]);
      },
      (err) => {
        console.error("Error fetching warehouses:", err);
        setAllBranches([]);
      },
    );
  }, [activeBusiness?.id]);

  // Form modal functions
  const openFormModal = () => {
    const wh = defaultWarehouse;
    setForm({
      date: moment().format("YYYY-MM-DD"),
      requisitor: `${user.firstname} ${user.lastname}`,
      branch: wh.branch || user.branch_name || "",
      branch_id: wh.branch_id || "",
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
    setErrors({ reason: "", supplier: "", branch: "" });
    setAttachments([]);
    getProductList();
    getCategories();
    getAllMeasures();
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setAttachments([]);
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

  const getAllMeasures = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/inventory/get-all-measure/${activeBusiness.id}`,
      (response) => {
        if (response?.success) {
          setAllMeasures(response.results || []);
        } else {
          setAllMeasures([]);
        }
      },
      (err) => {
        console.error("Error loading units of measure:", err);
        setAllMeasures([]);
      },
    );
  }, [activeBusiness?.id]);

  /** Unique active UoM options for line-item dropdowns. */
  const uomOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const m of allMeasures || []) {
      if (m.status && String(m.status).toLowerCase() !== "active") continue;
      const unit = String(m.unit || "").trim();
      if (!unit) continue;
      const key = unit.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      opts.push({
        unit,
        category: m.category || "",
        label: m.category ? `${unit} (${m.category})` : unit,
      });
    }
    return opts.sort((a, b) => a.unit.localeCompare(b.unit));
  }, [allMeasures]);

  const resolveUomMeta = useCallback(
    (uomValue) => {
      const unit = String(uomValue || "").trim();
      const fromMeasures = uomOptions.find(
        (o) => o.unit.toLowerCase() === unit.toLowerCase(),
      );
      const categoryObj = categories?.find((cat) =>
        cat.units?.includes(unit),
      );
      return {
        uom: unit,
        unit,
        unit_code: unit,
        category:
          fromMeasures?.category ||
          categoryObj?.category ||
          "",
        category_code:
          fromMeasures?.category ||
          categoryObj?.category ||
          "",
      };
    },
    [uomOptions, categories],
  );

  /** Options for a row: full list + current value if missing from catalog. */
  const uomSelectOptionsFor = useCallback(
    (currentUom) => {
      const current = String(currentUom || "").trim();
      if (
        current &&
        !uomOptions.some(
          (o) => o.unit.toLowerCase() === current.toLowerCase(),
        )
      ) {
        return [
          { unit: current, category: "", label: current },
          ...uomOptions,
        ];
      }
      return uomOptions;
    },
    [uomOptions],
  );

  // Form validation
  const validateForm = () => {
    const newErrors = {
      reason: "",
      supplier: "",
      branch: "",
    };

    let isValid = true;

    if (!form.supplier_name || !form.supplier_code) {
      toast.error("Preferred vendor/supplier is required");
      newErrors.supplier = "Preferred vendor/supplier is required";
      isValid = false;
    }

    if (!form.branch_id || !form.branch) {
      toast.error("Warehouse is required");
      newErrors.branch = "Select a warehouse";
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
    if (newExpense.item && parseQty(newExpense.quantity) > 0 && newExpense.uom) {
      setExpenses((prev) => [
        ...prev,
        {
          ...newExpense,
          quantity: displayFormattedAmount(newExpense.quantity) || "1",
        },
      ]);
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
    const unitOfMeasure = String(selected.unit_of_measure || "").trim();
    const uomMeta = unitOfMeasure
      ? resolveUomMeta(unitOfMeasure)
      : {
          uom: "",
          unit: "",
          unit_code: "",
          category: "",
          category_code: "",
        };
    setNewExpense((prev) => ({
      ...prev,
      item: selected.name || "",
      item_code: selected.code || "",
      chart_code: selected.chart_code || "",
      subhead: selected.subhead || "",
      ...uomMeta,
      // Keep previous UoM only if product has none configured
      uom: uomMeta.uom || prev.uom || "",
      unit: uomMeta.unit || prev.unit || "",
      unit_code: uomMeta.unit_code || prev.unit_code || "",
      category: uomMeta.category || prev.category || "",
      category_code: uomMeta.category_code || prev.category_code || "",
      quantity: prev.quantity || formatNumberWithCommas("1"),
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

  const handleAttachmentPick = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;

    const valid = [];
    for (const file of picked) {
      if (!isAllowedPoFile(file)) {
        toast.error(`${file.name}: only PDF, PNG, JPG, or DOCX`);
        continue;
      }
      if (file.size > MAX_PO_FILE_BYTES) {
        toast.error(`${file.name}: exceeds 25MB limit`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) return;

    setAttachmentUploading(true);
    try {
      const response = await PurchaseRequisitionAPI.stagePurchaseOrderDocuments(
        valid,
      );
      const uploaded = (response.data || []).map((doc) => ({
        ...doc,
        url: `${apiURL}/public/uploads/${doc.file_path}`,
      }));
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(
        uploaded.length === 1
          ? "Document uploaded"
          : `${uploaded.length} documents uploaded`,
      );
    } catch (error) {
      toast.error(error.message || "Failed to upload documents");
    } finally {
      setAttachmentUploading(false);
    }
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
        expenses: expenses.map((row) => ({
          ...row,
          quantity: parseQty(row.quantity),
        })),
        user_id: user.id,
        facilityId: activeBusiness.id,
      };

      const response = await PurchaseRequisitionAPI.submitPurchaseRequisition(
        requisitionData,
        attachments,
      );
      toast.success(response.message);

      // Close modal and refresh list
      setIsFormModalOpen(false);
      setAttachments([]);
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
                {!isHistory && canCreate && (
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
                            className="h-8 px-2 text-sm font-medium capitalize text-[var(--aa-accent)] hover:bg-slate-100 hover:text-[var(--aa-navy)]"
                          >
                            View
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

        <Modal isOpen={isOpen} toggle={toggle} size="lg" contentClassName="overflow-hidden border-0 shadow-lg">
          <ModalHeader
            toggle={toggle}
            className="border-0 text-white [&>.btn-close]:brightness-0 [&>.btn-close]:invert"
            style={{ background: "var(--aa-navy)" }}
          >
            View purchase order
          </ModalHeader>
          <ModalBody className="bg-white">
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

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Attachments (waybills / delivery docs)
                </p>
                {viewAttachments.length === 0 ? (
                  <p className="text-xs text-slate-500">No documents attached</p>
                ) : (
                  <ul className="space-y-1.5">
                    {viewAttachments.map((doc) => (
                      <li key={doc.id || doc.file_path}>
                        <a
                          href={`${apiURL}/public/uploads/${doc.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-[var(--aa-accent)] hover:text-[var(--aa-navy)] hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="truncate">
                            {doc.document_name || doc.original_name}
                          </span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
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
                <label htmlFor="po-warehouse" className={poLabelClass}>
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  id="po-warehouse"
                  name="branch_id"
                  value={form.branch_id || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    const match = warehouseOptions.find(
                      (b) => String(b.id) === String(id),
                    );
                    setForm((prev) => ({
                      ...prev,
                      branch_id: id,
                      branch: match?.branch_name || "",
                    }));
                    setErrors((prev) => ({ ...prev, branch: "" }));
                  }}
                  className={`${poInputClass} ${
                    errors.branch ? "border-red-500" : ""
                  }`}
                  disabled={warehouseOptions.length === 0}
                >
                  <option value="">
                    {warehouseOptions.length
                      ? "Select warehouse..."
                      : "No warehouse assigned to your account"}
                  </option>
                  {warehouseOptions.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
                {errors.branch && (
                  <p className="mt-1 text-xs text-red-500">{errors.branch}</p>
                )}
                {warehouseOptions.length === 1 ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Only your assigned warehouse is available.
                  </p>
                ) : null}
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
                        <th className="min-w-[8.5rem] w-36 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide">
                          Quantity
                        </th>
                        <th className="min-w-[7.5rem] w-36 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
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
                          <td className="min-w-[8.5rem] w-36 px-3 py-3 align-top text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              placeholder="0.00"
                              value={displayFormattedAmount(expense.quantity)}
                              onChange={(e) =>
                                updateExpenseField(index, {
                                  quantity: formatAmountInput(e.target.value),
                                })
                              }
                              className={poQtyInputClass}
                            />
                          </td>
                          <td className="px-2 py-3 align-top">
                            <select
                              value={expense.uom || expense.unit || ""}
                              onChange={(e) => {
                                updateExpenseField(
                                  index,
                                  resolveUomMeta(e.target.value),
                                );
                              }}
                              className="h-9 w-full min-w-[5.5rem] rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                              title="Unit of measure"
                            >
                              <option value="">Select UoM</option>
                              {uomSelectOptionsFor(
                                expense.uom || expense.unit,
                              ).map((opt) => (
                                <option key={opt.unit} value={opt.unit}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
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
                        <td className="min-w-[8.5rem] w-36 px-3 py-3 align-top text-right">
                          <input
                            ref={quantityInputRef}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="0.00"
                            value={displayFormattedAmount(newExpense.quantity)}
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
                                quantity: formatAmountInput(e.target.value),
                              })
                            }
                            className={poQtyInputClass}
                          />
                        </td>
                        <td className="px-2 py-3 align-top">
                          <select
                            ref={uomInputRef}
                            value={newExpense.uom || ""}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddExpense();
                              }
                            }}
                            onChange={(e) => {
                              setNewExpense((prev) => ({
                                ...prev,
                                ...resolveUomMeta(e.target.value),
                              }));
                            }}
                            className="h-9 w-full min-w-[5.5rem] rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[var(--aa-accent)] focus:ring-1 focus:ring-[var(--aa-accent)]"
                            title="Unit of measure"
                          >
                            <option value="">Select UoM</option>
                            {uomSelectOptionsFor(newExpense.uom).map((opt) => (
                              <option key={opt.unit} value={opt.unit}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-3 text-center align-top">
                          <button
                            type="button"
                            onClick={handleAddExpense}
                            disabled={
                              !newExpense.item ||
                              parseQty(newExpense.quantity) <= 0 ||
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
                          parseQty(newExpense.quantity) > 0 &&
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

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Attachments
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Waybills and other delivery documents (PDF, PNG, JPG, DOCX)
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {attachments.length}{" "}
                    {attachments.length === 1 ? "file" : "files"}
                  </span>
                </div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleAttachmentPick}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 border-slate-300"
                  disabled={formLoading || attachmentUploading}
                  onClick={() => attachmentInputRef.current?.click()}
                >
                  {attachmentUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {attachmentUploading ? "Uploading…" : "Upload documents"}
                </Button>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Files upload immediately. Click a name to open the file. 25MB each.
                </p>
                {attachments.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {attachments.map((file, idx) => {
                      const href = attachmentHref(file);
                      const label =
                        file.document_name ||
                        file.original_name ||
                        file.name;
                      const sizeBytes = file.file_size || file.size;
                      return (
                      <li
                        key={`${file.file_path || label}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 truncate">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--aa-accent)]" />
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[var(--aa-accent)] hover:text-[var(--aa-navy)] hover:underline"
                            >
                              {label}
                              {sizeBytes != null && (
                                <span className="text-slate-400">
                                  {" "}
                                  ({(sizeBytes / (1024 * 1024)).toFixed(1)} MB)
                                </span>
                              )}
                            </a>
                          ) : (
                            <span className="truncate">
                              {label}{" "}
                              {sizeBytes != null && (
                                <span className="text-slate-400">
                                  ({(sizeBytes / (1024 * 1024)).toFixed(1)} MB)
                                </span>
                              )}
                            </span>
                          )}
                          {href ? (
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                          ) : null}
                        </span>
                        <button
                          type="button"
                          disabled={formLoading || attachmentUploading}
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          className="shrink-0 text-red-600 hover:text-red-700"
                          title="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
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
                disabled={expenses.length === 0 || formLoading || attachmentUploading}
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
