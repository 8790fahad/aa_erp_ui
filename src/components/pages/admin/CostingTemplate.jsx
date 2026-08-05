/* eslint-disable react/prop-types */
/* eslint-disable no-unused-vars */
import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
  Fragment,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "reactstrap";
import { Card, Label, Input, FormGroup } from "reactstrap/lib";
import {
  Settings,
  Check,
  X,
  Save,
  Plus,
  Edit,
  Trash2,
  FileText,
  Eye,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { _postApi, _fetchApi, _putApi } from "@/redux/actions/api";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import { Typeahead } from "react-bootstrap-typeahead";
import { formatNumber1 } from "@/components/router/utilities";

/** Sentinel `activeSharedProductIndex` when adding line items for Template By-Product */
const TEMPLATE_BY_PRODUCT_LINE_INDEX = -2;

// Sortable row wrapper for Items to be added
function SortableItemRow({ item, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-80 bg-gray-100" : ""}
    >
      <td
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 align-middle"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </td>
      {children}
    </tr>
  );
}

// Sortable row for Shared Costs
function SortableSharedCostRow({ item, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? "opacity-80 bg-gray-100" : ""}
    >
      <td
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 align-middle"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </td>
      {children}
    </tr>
  );
}

const CostingTemplate = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingProductId, setEditingProductId] = useState(null); // When editing, product whose items we're editing
  const [editingSemiTemplateId, setEditingSemiTemplateId] = useState(null); // Semi-finished DB template UUID when editing
  const [semiCostingTemplateName, setSemiCostingTemplateName] =
    useState("Default");
  const [semiCostingIsDefault, setSemiCostingIsDefault] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null); // Inline edit: which raw material item
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedGoodProducts, setFinishedGoodProducts] = useState([]);
  const [semiFinishedProducts, setSemiFinishedProducts] = useState([]);
  const [templateProductType, setTemplateProductType] = useState("finished_good"); // "finished_good" | "semi_finished"
  const [productGroups, setProductGroups] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [itemList, setItemList] = useState([]);
  const expenseTypeaheadRef = useRef(null);

  // Drag-and-drop sensors for Items to be added
  const itemListSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor, {})
  );

  // Costing mode: "single" or "shared"
  const [costingMode, setCostingMode] = useState("single");

  // Shared costing state
  const [editingSharedGroupId, setEditingSharedGroupId] = useState(null); // When editing existing shared costing
  const [sharedCostingName, setSharedCostingName] = useState("");
  const [productIds, setProductIds] = useState("");
  const [sharedCosts, setSharedCosts] = useState([]); // {type: 'raw_material'|'waste', ...}
  const [editingSharedCostId, setEditingSharedCostId] = useState(null);
  const [editingSharedProductItemKey, setEditingSharedProductItemKey] =
    useState(null); // "pIndex-itemId" when editing a product item
  const [sharedProducts, setSharedProducts] = useState([]); // [{product, items: [...]}]
  const [activeSharedProductIndex, setActiveSharedProductIndex] =
    useState(null);
  const [outputPercentage, setOutputPercentage] = useState("");
  const [units, setUnits] = useState("");
  const [templateByProductList, setTemplateByProductList] = useState([]);
  const [selectedTemplateByProduct, setSelectedTemplateByProduct] =
    useState(null);
  const [templateByProductQty, setTemplateByProductQty] = useState("1");
  const [templateByProductUnitCost, setTemplateByProductUnitCost] =
    useState("");
  const [templateByProductItems, setTemplateByProductItems] = useState([]);

  const [form, setForm] = useState({
    finished_good_product_id: "",
    type: "",
    description: "",
    description_code: "",
    account_head: "",
    quantity: "",
    amount: "",
    raw_material_id: "",
    raw_material_name: "",
    raw_material_sku: "",
    product_id: "",
    other_type: "",
    rate: "",
    percentage_basis: "",
  });
  const [selectedRawMaterial, setSelectedRawMaterial] = useState(null);
  const [selectedSemiFinishedItem, setSelectedSemiFinishedItem] = useState(null);
  const [valuationCostHint, setValuationCostHint] = useState("");
  const valuationFetchSeq = useRef(0);
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();

  // Number formatting functions (same as JournalEntryForm)
  const formatNumberWithCommas = (value) => {
    if (!value || value === "") return "";

    // Remove all non-numeric characters except decimal point
    const numericValue = String(value).replace(/[^0-9.]/g, "");

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
    // Remove commas and keep only numbers and decimal point
    return String(value).replace(/,/g, "");
  };

  const handleNumericInput = (value) => {
    // Allow numbers, dots, and commas
    return value.replace(/[^0-9.,]/g, "");
  };

  // Format quantity with up to 4 decimal places
  const formatQuantity = (value) => {
    if (!value && value !== 0) return "0";
    const num = parseFloat(value) || 0;
    // Format with up to 4 decimal places, removing trailing zeros
    return num.toFixed(4).replace(/\.?0+$/, "") || "0";
  };

  // Load templates from API - product groups (ProductGroup model) first, then costing templates
  const loadTemplates = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);

    // Fetch product groups (ProductGroup model) first - primary source for shared costing
    _fetchApi(
      `/api/product-groups?facilityId=${activeBusiness.id}`,
      (sharedResponse) => {
        const productGroups = sharedResponse.success
          ? sharedResponse.data || []
          : [];

        // Convert shared costing groups (from ProductGroup) to template format
        // Filter by description (set when creating) or notes - both identify shared costing
        const sharedTemplates = productGroups
          .filter((group) => {
            const hasDesc =
              group.description &&
              String(group.description).includes("Shared Costing Template");
            const hasNotes =
              group.notes &&
              (typeof group.notes === "string"
                ? group.notes.includes("Shared Costing Template")
                : JSON.stringify(group.notes || {}).includes(
                    "Shared Costing Template"
                  ));
            // Also include groups with sharedCost/products in notes (JSON structure)
            const hasSharedCostStructure =
              group.notes &&
              typeof group.notes === "object" &&
              (Array.isArray(group.notes.sharedCost) ||
                Array.isArray(group.notes.products) ||
                (group.notes.templateByProduct &&
                  typeof group.notes.templateByProduct === "object"));
            return hasDesc || hasNotes || hasSharedCostStructure;
          })
          .map((group) => {
                const notesRaw = group.notes;
                const notes =
                  typeof notesRaw === "string"
                    ? notesRaw
                    : notesRaw && typeof notesRaw === "object"
                      ? JSON.stringify(notesRaw)
                      : "";
                let productItems = [];
                let costingData = null;

                // Try to use notes as JSON object first (when DB returns parsed JSON)
                if (notesRaw && typeof notesRaw === "object" && (notesRaw.products || notesRaw.sharedCost || notesRaw.templateByProduct)) {
                  costingData = notesRaw;
                  productItems = (notesRaw.products || []).map((p) => ({
                    name: p.productName,
                    sku: p.productSku,
                    items: (p.items || []).map((item) => ({
                      type: item.type,
                      description: item.description,
                      quantity: item.quantity,
                      rawMaterialId: item.rawMaterialId,
                      rawMaterialSku: item.rawMaterialSku,
                    })),
                  }));
                } else if (typeof notes === "string") {
                  // Try to parse JSON string
                  try {
                    const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
                    const jsonStr = jsonMatch ? jsonMatch[1] : notes;
                    costingData = JSON.parse(jsonStr);
                    if (typeof costingData === "string") costingData = JSON.parse(costingData);
                    if (costingData?.products) {
                      productItems = costingData.products.map((p) => ({
                        name: p.productName,
                        sku: p.productSku,
                        items: (p.items || []).map((item) => ({
                          type: item.type,
                          description: item.description,
                          quantity: item.quantity,
                          rawMaterialId: item.rawMaterialId,
                          rawMaterialSku: item.rawMaterialSku,
                        })),
                      }));
                    }
                  } catch (e) {
                  console.warn(
                    "Failed to parse JSON from notes, falling back to text parsing:",
                    e
                  );
                  }
                }

                // Fallback to text parsing if JSON parsing failed
                if (!costingData || productItems.length === 0) {
                  const lines = (notes || "").split("\n");
                  let currentProduct = null;
                  let inProducts = false;

                  lines.forEach((line) => {
                    if (line.includes("Products in this shared costing:")) {
                      inProducts = true;
                    } else if (inProducts && line.trim().match(/^\d+\./)) {
                      // Check if this is a product line or an item line
                      if (line.includes("Type:")) {
                        // This is an item line
                        if (currentProduct) {
                          const typeMatch = line.match(/Type:\s*(\w+)/);
                          const descMatch = line.match(
                            /Description:\s*([^,]+)/
                          );
                          const qtyMatch = line.match(/Quantity:\s*([\d.]+)/);
                          const rmIdMatch = line.match(
                            /RawMaterialId:\s*([^,]+)/
                          );
                          const rmSkuMatch = line.match(
                            /RawMaterialSku:\s*([^,\s]+)/
                          );

                          if (typeMatch && descMatch) {
                            currentProduct.items.push({
                              type: typeMatch[1],
                              description: descMatch[1].trim(),
                              quantity: qtyMatch
                                ? parseFloat(qtyMatch[1])
                                : null,
                              rawMaterialId: rmIdMatch
                                ? rmIdMatch[1].trim()
                                : null,
                              rawMaterialSku: rmSkuMatch
                                ? rmSkuMatch[1].trim()
                                : null,
                            });
                          }
                        }
                      } else {
                        // This is a product line: " 1. Maize Flour 10kg (PROD-00159)"
                        const productMatch = line.match(
                          /\d+\.\s*([^(]+)\s*\(([^)]+)\)/
                        );
                        if (productMatch) {
                          currentProduct = {
                            name: productMatch[1].trim(),
                            sku: productMatch[2].trim(),
                            items: [],
                          };
                          productItems.push(currentProduct);
                        }
                      }
                    } else if (
                      inProducts &&
                      line.trim() === "Product Specific Items:"
                    ) {
                      // Found product specific items header, keep currentProduct active
                    }
                  });
                }

                return {
                  id: `shared-${group.id}`,
                  product_id: group.id,
                  finished_good_product_id: group.id,
                  type: "shared_costing",
                  description: group.name,
                  description_code: "SHARED",
                  quantity: group.products?.length || 0,
                  amount: 0,
                  raw_material_id: null,
                  raw_material_name: null,
                  raw_material_sku: null,
                  other_type: "shared",
                  rate: null,
                  percentage_basis: null,
                  created_at: group.created_at,
                  updated_at: group.updated_at,
                  is_shared: true,
                  group_data: group,
                  product_items: productItems,
                  costing_data: costingData, // Include parsed JSON data
                };
          });

        // Then fetch single costing templates
        _fetchApi(
          `/api/costing-templates?facilityId=${activeBusiness.id}`,
          (singleResponse) => {
            const singleTemplates = singleResponse.success
              ? singleResponse.data || []
              : [];
            setTemplates([...singleTemplates, ...sharedTemplates]);
            setLoading(false);
          },
          (error) => {
            console.error("Error loading costing templates:", error);
            setTemplates(sharedTemplates);
            setLoading(false);
          }
        );
      },
      (error) => {
        console.error("Error loading product groups:", error);
        toast.error("Error loading costing templates");
        setTemplates([]);
        setLoading(false);
      }
    );
  }, [activeBusiness?.id]);

  // Load Finished Good products
  const loadFinishedGoodProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/products/list/${activeBusiness.id}?itemType=Finished Good&status=Active&limit=1000`,
      (resp) => {
        if (resp.success) {
          setFinishedGoodProducts(
            (resp.data?.products || resp.data || []).map((product) => ({
              id: product.id,
              name: product.name,
              sku: product.sku,
              item_type: product.item_type,
              cost_price: product.cost_price,
              selling_price: product.selling_price,
            }))
          );
        } else {
          toast.error("Failed to load finished good products");
        }
      },
      (err) => {
        console.error("API Error:", err);
        // Try alternative endpoint
        _postApi(
          `/inventory/product-list-2?query_type=select`,
          {
            facilityId: activeBusiness.id,
            type: "Finished Good",
          },
          (resp) => {
            if (resp.success) {
              setFinishedGoodProducts(
                (resp.results || []).map((product) => ({
                  id: product.id || product.item_code,
                  name: product.item_name || product.name,
                  sku: product.sku || product.item_code,
                  item_type: product.item_type,
                  cost_price: product.cost_price,
                  selling_price: product.selling_price,
                }))
              );
            }
          },
          (err2) => {
            console.error("API Error:", err2);
            toast.error(
              "Something went wrong while fetching finished good products."
            );
          }
        );
      }
    );
  }, [activeBusiness?.id]);

  // Load Semi-finished products
  const loadSemiFinishedProducts = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/inventory/get-semifinshed-list?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setSemiFinishedProducts(
            (resp.data?.products || resp.data?.items || resp.results || resp.data || []).map((p) => ({
              id: p.id,
              name: p.name,
              sku: p.sku,
              item_type: p.item_type,
              cost_price: p.cost_price,
              notes: p.notes ?? null,
              semi_finished_costing_templates:
                p.semi_finished_costing_templates ?? null,
              semi_finished_costing_items: p.semi_finished_costing_items ?? null,
            }))
          );
        } else {
          toast.error("Failed to load semi-finished products");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching semi-finished products.");
      }
    );
  }, [activeBusiness?.id]);

  // Load expense list for "other" type description
  const loadExpenseList = useCallback(() => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          // Filter to only include expense/cost accounts, exclude products
          const filteredResults = (resp.results || []).filter((item) => {
            const accountType = (item.account_type || "").toLowerCase();
            // Only include items that are expense-related accounts
            return true;
          });
          setExpenseList(
            filteredResults.map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
              account_type: item.account_type || "",
            }))
          );
        } else {
          toast.error("Failed to load expense items");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching expense items.");
      }
    );
  }, [activeBusiness?.id]);

  // Load product groups
  const loadProductGroups = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/product-groups?facilityId=${activeBusiness.id}`,
      (response) => {
        if (response.success) {
          setProductGroups(response.data || []);
        } else {
          toast.error("Failed to load product groups");
        }
      },
      (error) => {
        console.error("Error loading product groups:", error);
        toast.error("Error loading product groups");
      }
    );
  }, [activeBusiness?.id]);
  // Load raw materials from raw_material_inventory
  const loadRawMaterials = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/inventory/raw-material/list-for-costing-template?facilityId=${activeBusiness.id}&branch_name=${activeBusiness.branch_name}`,
      (resp) => {
        if (resp.success) {
          setRawMaterials(
            (resp.results || []).map((item) => ({
              id: item.product_id,
              name: item.name,
              sku: item.product_id, // Using product_id as SKU identifier
              product_id: item.product_id,
              cost_price: item.cost_price,
              reorder_level: item.reorder_level,
              expiry_date: item.expiry_date,
            }))
          );
        } else {
          toast.error("Failed to load raw materials");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching raw materials.");
      }
    );
  }, [activeBusiness?.id]);

  const loadTemplateByProducts = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/api/products?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success && Array.isArray(resp.data)) {
          setTemplateByProductList(
            resp.data
              .filter(
                (p) => String(p.item_type || "").trim() === "By-Product",
              )
              .map((p) => ({
                id: p.id,
                name: p.name || p.item_name,
                sku: p.sku || p.item_code,
                item_code: p.item_code || p.sku,
                cost_price: p.cost_price,
                item_type: p.item_type,
              })),
          );
        } else {
          setTemplateByProductList([]);
        }
      },
      () => setTemplateByProductList([]),
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    loadTemplates();
    loadRawMaterials();
    loadFinishedGoodProducts();
    loadSemiFinishedProducts();
    loadExpenseList();
    loadProductGroups();
    loadTemplateByProducts();
  }, [
    loadTemplates,
    loadRawMaterials,
    loadFinishedGoodProducts,
    loadSemiFinishedProducts,
    loadExpenseList,
    loadProductGroups,
    loadTemplateByProducts,
  ]);

  // Default unit cost from business valuation (inv_ev_m, default_valuation_source, valuation_date period shown in hint)
  useEffect(() => {
    if (form.type !== "raw_material" && form.type !== "semi_finished") {
      setValuationCostHint("");
      return;
    }
    const selected =
      form.type === "raw_material"
        ? selectedRawMaterial
        : selectedSemiFinishedItem;
    if (!selected || !activeBusiness?.id) {
      setValuationCostHint("");
      return;
    }
    const sku = String(
      selected.sku || selected.product_id || selected.id || "",
    ).trim();
    if (!sku) {
      setValuationCostHint("");
      return;
    }
    const fallback =
      selected.cost_price != null && selected.cost_price !== ""
        ? String(selected.cost_price).replace(/,/g, "")
        : "";
    const seq = ++valuationFetchSeq.current;
    _fetchApi(
      `/inventory/product-unit-cost/${encodeURIComponent(sku)}/${activeBusiness.id}`,
      (resp) => {
        if (seq !== valuationFetchSeq.current) return;
        if (resp.success && resp.data) {
          const uc = resp.data.unit_cost;
          const num = uc != null ? Number(uc) : 0;
          const rateStr =
            Number.isFinite(num) && num > 0
              ? String(num)
              : fallback || "";
          setForm((prev) => ({
            ...prev,
            rate: rateStr,
          }));
          const d = resp.data;
          const methodLabel =
            d.valuation_method === "default_cost"
              ? "product default cost (business setting)"
              : `${d.valuation_method} — system valuation per business inventory method`;
          let hint = `${methodLabel}. Editable.`;
          if (
            d.valuation_frequency &&
            d.valuation_frequency !== "All" &&
            d.valuation_period_start &&
            d.valuation_period_end
          ) {
            hint += ` Valuation period (${d.valuation_frequency}): ${d.valuation_period_start} – ${d.valuation_period_end}.`;
          }
          setValuationCostHint(hint);
        } else if (fallback) {
          setForm((prev) => ({ ...prev, rate: fallback }));
          setValuationCostHint(
            "Using product default cost (valuation response empty). Editable.",
          );
        } else {
          setValuationCostHint(
            "Could not resolve unit cost; enter manually. Editable.",
          );
        }
      },
      () => {
        if (seq !== valuationFetchSeq.current) return;
        if (fallback) {
          setForm((prev) => ({ ...prev, rate: fallback }));
          setValuationCostHint(
            "Using product default cost (request failed). Editable.",
          );
        } else {
          setValuationCostHint(
            "Could not load valuation cost; enter manually. Editable.",
          );
        }
      },
    );
  }, [
    form.type,
    selectedRawMaterial,
    selectedSemiFinishedItem,
    activeBusiness?.id,
  ]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear ingredient selections if type changes away from ingredient types
    if (field === "type" && value !== "raw_material" && value !== "semi_finished") {
      setSelectedRawMaterial(null);
      setSelectedSemiFinishedItem(null);
      setForm((prev) => ({
        ...prev,
        raw_material_id: "",
        raw_material_name: "",
        raw_material_sku: "",
      }));
    }

    // When switching between raw material and semi-finished, clear the other selector
    if (field === "type" && value === "raw_material") {
      setSelectedSemiFinishedItem(null);
    }
    if (field === "type" && value === "semi_finished") {
      setSelectedRawMaterial(null);
    }

    // Clear expense selection if type changes (keep for "other" and "by_product_credit")
    if (
      field === "type" &&
      value !== "other" &&
      value !== "by_product_credit"
    ) {
      setSelectedExpense(null);
      setForm((prev) => ({
        ...prev,
        description: "",
        description_code: "",
        account_head: "",
        other_type: "",
        rate: "",
        percentage_basis: "",
      }));
    }

    // Clear rate/percentage fields when other_type changes
    if (field === "other_type") {
      setForm((prev) => ({
        ...prev,
        rate: "",
        quantity: "",
        percentage_basis: "",
      }));
    }
  };

  const handleCreate = () => {
    setTemplateProductType("finished_good");
    setEditingTemplate(null);
    setEditingProductId(null);
    setEditingSharedGroupId(null);
    setSelectedRawMaterial(null);
    setSelectedProduct(null);
    setSelectedExpense(null);
    setItemList([]);
    setCostingMode("single");
    setSharedCostingName("");
    setSharedCosts([]);
    setSharedProducts([]);
    setActiveSharedProductIndex(null);
    setSelectedTemplateByProduct(null);
    setTemplateByProductQty("1");
    setTemplateByProductUnitCost("");
    setTemplateByProductItems([]);
    setOutputPercentage("");
    setValuationCostHint("");
    setForm({
      finished_good_product_id: "",
      type: "",
      description: "",
      description_code: "",
      account_head: "",
      quantity: "",
      amount: "",
      raw_material_id: "",
      raw_material_name: "",
      raw_material_sku: "",
      product_id: "",
      other_type: "",
      rate: "",
      percentage_basis: "",
    });
    setIsModalOpen(true);
  };

  const handleCreateSemi = () => {
    setTemplateProductType("semi_finished");
    setEditingTemplate(null);
    setEditingProductId(null);
    setEditingSharedGroupId(null);
    setSelectedRawMaterial(null);
    setSelectedProduct(null);
    setSelectedExpense(null);
    setItemList([]);
    setCostingMode("semi_finished");
    setSharedCostingName("");
    setSharedCosts([]);
    setSharedProducts([]);
    setActiveSharedProductIndex(null);
    setSelectedTemplateByProduct(null);
    setTemplateByProductQty("1");
    setTemplateByProductUnitCost("");
    setTemplateByProductItems([]);
    setOutputPercentage("");
    setValuationCostHint("");
    // Pre-fill form for semi-finished: lock to raw_material with sensible defaults
    setForm({
      finished_good_product_id: "",
      type: "raw_material",
      description: "",
      description_code: "",
      account_head: "",
      quantity: "1",
      amount: "",
      raw_material_id: "",
      raw_material_name: "",
      raw_material_sku: "",
      product_id: "",
      other_type: "",
      rate: "0",
      percentage_basis: "",
    });
    setIsModalOpen(true);
  };

  // Edit shared costing - open modal with group data pre-populated
  const handleEditShared = (group) => {
    const groupData = group.groupData || group.group_data || group;
    setCostingMode("shared");
    setEditingTemplate(null);
    setEditingProductId(null);
    setEditingSharedGroupId(groupData.id);
    setEditingSharedCostId(null);
    setEditingSharedProductItemKey(null);
    setSharedCostingName(groupData.name || "");
    setProductIds(groupData.id);
    setSharedCosts([]);
    setSharedProducts([]);
    setOutputPercentage("");
    setSelectedTemplateByProduct(null);
    setTemplateByProductQty("1");
    setTemplateByProductUnitCost("");
    setTemplateByProductItems([]);
    setActiveSharedProductIndex(null);
    setIsModalOpen(true);

    const applyData = (data, groupForProducts = groupData) => {
      if (!data) return;
      const sharedCost = data.sharedCost || data.shared_cost || [];
      const products = data.products || data.Products || [];

      if (Array.isArray(sharedCost) && sharedCost.length > 0) {
        setSharedCosts(
          sharedCost.map((item) => ({
            id: item.id || Date.now() + Math.random(),
            type: item.type || "raw_material",
            description: item.description || "",
            description_code: item.descriptionCode || item.description_code || "",
            account_head: item.accountHead || item.account_head || "",
            quantity: item.quantity || 0,
            raw_material_id: item.rawMaterialId || item.raw_material_id || "",
            raw_material_name: item.rawMaterialName || item.raw_material_name || "",
            raw_material_sku: item.rawMaterialSku || item.raw_material_sku || "",
            other_type: item.otherType || item.other_type || "",
            rate: item.rate ?? item.rate_amount ?? "",
            percentage_basis: item.percentageBasis || item.percentage_basis || "",
          }))
        );
      }

      if (Array.isArray(products) && products.length > 0) {
        setSharedProducts(
          products.map((p) => {
            const productItems = p.items || p.Items || [];
            return {
              product: {
                id: p.productId || p.product_id,
                name: p.productName || p.product_name,
                sku: p.productSku || p.product_sku,
              },
              multiple: p.units ?? p.multiple ?? 0,
              items: productItems.map((item) => ({
                id: item.id || Date.now() + Math.random(),
                type: item.type || "raw_material",
                description: item.description || "",
                description_code: item.descriptionCode || item.description_code || "",
                account_head: item.accountHead || item.account_head || "",
                quantity: item.quantity ?? 0,
                raw_material_id: item.rawMaterialId || item.raw_material_id || "",
                raw_material_name: item.rawMaterialName || item.raw_material_name || "",
                raw_material_sku: item.rawMaterialSku || item.raw_material_sku || "",
                other_type: item.otherType || item.other_type || "rate",
                rate: item.rate ?? item.rate_amount ?? item.unit_cost ?? "",
                percentage_basis: item.percentageBasis || item.percentage_basis || "",
              })),
            };
          })
        );
      } else if (groupForProducts?.products?.length) {
        setSharedProducts(
          groupForProducts.products.map((p) => ({
            product: { id: p.id, name: p.name, sku: p.sku },
            multiple: 0,
            items: [],
          }))
        );
      }

      if (data.output != null && data.output !== "") {
        setOutputPercentage(String(data.output));
      }

      const tbp =
        data.templateByProduct ||
        data.template_by_product ||
        data.TemplateByProduct;
      if (tbp && typeof tbp === "object") {
        const pid = tbp.productId ?? tbp.product_id;
        const pname = tbp.productName ?? tbp.product_name ?? "";
        const psku = tbp.productSku ?? tbp.product_sku ?? tbp.item_code ?? "";
        const u = tbp.units ?? tbp.qty ?? tbp.multiple;
        if (pid != null && pid !== "") {
          setSelectedTemplateByProduct({
            id: pid,
            name: pname,
            sku: psku,
            item_code: tbp.item_code || psku,
          });
        } else {
          setSelectedTemplateByProduct(null);
        }
        setTemplateByProductQty(u != null && u !== "" ? String(u) : "1");
        const uc = tbp.unit_cost ?? tbp.unitCost;
        setTemplateByProductUnitCost(
          uc != null && uc !== "" ? String(uc) : "",
        );
        const tItems = tbp.items || tbp.Items || [];
        if (Array.isArray(tItems) && tItems.length > 0) {
          setTemplateByProductItems(
            tItems.map((item) => ({
              id: item.id || Date.now() + Math.random(),
              type: item.type || "raw_material",
              description: item.description || "",
              description_code:
                item.descriptionCode || item.description_code || "",
              account_head: item.accountHead || item.account_head || "",
              quantity: item.quantity ?? 0,
              raw_material_id:
                item.rawMaterialId || item.raw_material_id || "",
              raw_material_name:
                item.rawMaterialName || item.raw_material_name || "",
              raw_material_sku:
                item.rawMaterialSku || item.raw_material_sku || "",
              other_type: item.otherType || item.other_type || "rate",
              rate: item.rate ?? item.rate_amount ?? item.unit_cost ?? "",
              percentage_basis:
                item.percentageBasis || item.percentage_basis || "",
            })),
          );
        } else {
          setTemplateByProductItems([]);
        }
      } else {
        setSelectedTemplateByProduct(null);
        setTemplateByProductQty("1");
        setTemplateByProductUnitCost("");
        setTemplateByProductItems([]);
      }
    };

    // Get data: prefer costing_data (from template), then parse notes from group
    let data = group.costing_data || groupData.costing_data || null;

    if (!data) {
      let notes = groupData.notes;
      if (typeof notes === "string") {
        try {
          const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
          let parsed = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(notes);
          // Handle double-encoded JSON (e.g. notes stored as stringified string)
          if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }
          data = parsed;
        } catch (e) {
          console.warn("Failed to parse notes JSON:", e);
        }
      } else if (notes && typeof notes === "object") {
        data = notes;
      }
    }

    if (data) {
      applyData(data);
    } else {
      // Fetch group to get notes (in case template didn't have costing_data)
      _fetchApi(
        `/api/product-groups?facilityId=${activeBusiness.id}`,
        (resp) => {
          if (resp.success && resp.data) {
            const fetchedGroup = resp.data.find((g) => g.id === groupData.id);
            if (fetchedGroup?.notes) {
              let parsed = fetchedGroup.notes;
              if (typeof parsed === "string") {
                try {
                  parsed = JSON.parse(parsed);
                  if (typeof parsed === "string") parsed = JSON.parse(parsed);
                } catch (e) {
                  return;
                }
              }
              if (parsed && typeof parsed === "object") {
                applyData(parsed, fetchedGroup);
              }
            }
          }
        }
      );
    }
  };

  // Handle product group selection (only overwrite when NOT editing with loaded data)
  const handleProductGroupSelection = (group) => {
    if (group) {
      setSharedCostingName(group.name);
      setProductIds(group.id);
      // When editing, we already have sharedProducts from handleEditShared - don't overwrite
      if (editingSharedGroupId && group.id === editingSharedGroupId) {
        return; // Keep existing loaded data
      }
      // Clear existing products and add group products (for create or switching group)
      const groupProducts = group.products.map((product) => ({
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
        },
        multiple: 0,
        items: [],
      }));
      setSharedProducts(groupProducts);
      setSelectedTemplateByProduct(null);
      setTemplateByProductQty("1");
      setTemplateByProductUnitCost("");
      setTemplateByProductItems([]);
      setActiveSharedProductIndex(null);
    } else {
      setSharedCostingName("");
      setSharedProducts([]);
      setSelectedTemplateByProduct(null);
      setTemplateByProductQty("1");
      setTemplateByProductUnitCost("");
      setTemplateByProductItems([]);
      setActiveSharedProductIndex(null);
    }
  };

  // Shared costing helpers
  const resetFormForShared = () => {
    setForm({
      finished_good_product_id: "",
      type: "",
      description: "",
      description_code: "",
      account_head: "",
      quantity: "",
      amount: "",
      raw_material_id: "",
      raw_material_name: "",
      raw_material_sku: "",
      product_id: "",
      other_type: "",
      rate: "",
      percentage_basis: "",
    });
    setSelectedRawMaterial(null);
    setSelectedSemiFinishedItem(null);
    setSelectedExpense(null);
  };

  const handleAddSharedCost = () => {
    if (!form.type) {
      toast.error("Please select a type");
      return;
    }
    if (
      (form.type === "raw_material" || form.type === "semi_finished") &&
      !form.raw_material_id
    ) {
      toast.error(
        form.type === "semi_finished"
          ? "Please select a semi-finished item"
          : "Please select a raw material"
      );
      return;
    }
    if (
      (form.type === "raw_material" || form.type === "semi_finished") &&
      (!form.quantity || parseFloat(form.quantity) <= 0)
    ) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (
      (form.type === "waste" ||
        form.type === "other" ||
        form.type === "by_product_credit") &&
      !form.account_head?.trim()
    ) {
      toast.error("Account Head is required");
      return;
    }
    if (
      (form.type === "waste" ||
        form.type === "other" ||
        form.type === "by_product_credit") &&
      !form.description?.trim()
    ) {
      toast.error("Description is required");
      return;
    }
    if (
      (form.type === "waste" ||
        form.type === "other" ||
        form.type === "by_product_credit") &&
      !form.other_type
    ) {
      toast.error("Please select input type (Rate or Percentage)");
      return;
    }
    if (
      (form.type === "waste" ||
        form.type === "other" ||
        form.type === "by_product_credit") &&
      form.other_type === "rate" &&
      (!form.rate || parseFloat(form.rate) <= 0)
    ) {
      toast.error("Rate must be greater than 0");
      return;
    }
    if (
      (form.type === "waste" ||
        form.type === "other" ||
        form.type === "by_product_credit") &&
      form.other_type === "percentage" &&
      (!form.quantity || parseFloat(form.quantity) <= 0)
    ) {
      toast.error("Percentage must be greater than 0");
      return;
    }
    if (
      (form.type === "waste" ||
        form.type === "other" ||
        form.type === "by_product_credit") &&
      form.other_type === "percentage" &&
      !form.percentage_basis
    ) {
      toast.error("Percentage Basis is required");
      return;
    }

    const newItem = {
      id: Date.now(),
      type: form.type,
      description:
        form.type === "raw_material"
          ? form.raw_material_name
          : form.description,
      description_code: form.description_code || "",
      account_head: form.account_head || "",
      quantity: parseFloat(form.quantity) || 0,
      raw_material_id: form.raw_material_id || "",
      raw_material_name: form.raw_material_name || "",
      raw_material_sku: form.raw_material_sku || "",
      other_type: form.other_type || "",
      rate: form.rate ? String(form.rate).replace(/,/g, "") : "",
      percentage_basis: form.percentage_basis || "",
    };

    setSharedCosts((prev) => [...prev, newItem]);
    resetFormForShared();
    toast.success("Shared cost added");
  };

  const handleAddSharedProduct = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }
    const exists = sharedProducts.some(
      (p) => p.product.id === selectedProduct.id
    );
    if (exists) {
      toast.error("Product already added");
      return;
    }
    setSharedProducts((prev) => [
      ...prev,
      { product: selectedProduct, items: [] },
    ]);
    setSelectedProduct(null);
    toast.success("Product added");
  };

  const handleAddItemToSharedProduct = (productIndex) => {
    if (productIndex === TEMPLATE_BY_PRODUCT_LINE_INDEX) {
      if (!selectedTemplateByProduct) {
        toast.error("Select a template by-product first");
        return;
      }
      if (form.type === "by_product_credit") {
        toast.error("By-product type is not allowed for template by-product line items");
        return;
      }
    } else if (productIndex < 0 || productIndex >= sharedProducts.length) {
      return;
    }

    if (!form.type) {
      toast.error("Please select a type");
      return;
    }

    if (form.type === "raw_material" || form.type === "semi_finished") {
      if (!form.raw_material_id) {
        toast.error(
          form.type === "semi_finished"
            ? "Please select a semi-finished item"
            : "Please select a raw material"
        );
        return;
      }
      if (!form.quantity || parseFloat(form.quantity) <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }
    }

    if (form.type === "other" || form.type === "by_product_credit") {
      if (!form.account_head?.trim()) {
        toast.error("Please select an account head");
        return;
      }
      if (!form.description?.trim()) {
        toast.error("Description is required");
        return;
      }
      if (!form.other_type) {
        toast.error("Please select an input type (Rate or Percentage)");
        return;
      }
      if (form.other_type === "rate") {
        if (
          !form.rate ||
          parseFloat(String(form.rate).replace(/,/g, "")) <= 0
        ) {
          toast.error("Rate must be greater than 0");
          return;
        }
      }
      if (form.other_type === "percentage") {
        if (!form.quantity || parseFloat(form.quantity) <= 0) {
          toast.error("Percentage must be greater than 0");
          return;
        }
        if (!form.percentage_basis) {
          toast.error("Please select a percentage basis");
          return;
        }
      }
    }

    const newItem = {
      id: Date.now(),
      type: form.type,
      description:
        form.type === "raw_material" || form.type === "semi_finished"
          ? form.raw_material_name
          : form.description,
      description_code: form.description_code || "",
      account_head: form.account_head || "",
      quantity:
        form.type === "raw_material" || form.type === "semi_finished"
          ? parseFloat(form.quantity) || 0
          : form.other_type === "percentage"
          ? parseFloat(form.quantity) || 0
          : 0,
      raw_material_id: form.raw_material_id || "",
      raw_material_name: form.raw_material_name || "",
      raw_material_sku: form.raw_material_sku || "",
      other_type: form.other_type || "",
      rate: form.rate ? String(form.rate).replace(/,/g, "") : "",
      percentage_basis: form.percentage_basis || "",
    };

    if (productIndex === TEMPLATE_BY_PRODUCT_LINE_INDEX) {
      setTemplateByProductItems((prev) => [...prev, newItem]);
      resetFormForShared();
      setActiveSharedProductIndex(null);
      toast.success("Item added to template by-product");
      return;
    }

    setSharedProducts((prev) => {
      const updated = [...prev];
      updated[productIndex].items.push(newItem);
      return updated;
    });
    resetFormForShared();
    setActiveSharedProductIndex(null);
    toast.success("Item added to product");
  };

  const handleRemoveTemplateByProductItem = (itemId) => {
    setTemplateByProductItems((prev) => prev.filter((i) => i.id !== itemId));
    setEditingSharedProductItemKey((key) =>
      key === `tbp-${itemId}` ? null : key,
    );
  };

  const handleUpdateTemplateByProductItem = (itemId, updates) => {
    setTemplateByProductItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
    );
  };

  const handleRemoveSharedCost = (id) => {
    setSharedCosts((prev) => prev.filter((item) => item.id !== id));
    setEditingSharedCostId(null);
  };

  const handleUpdateSharedCostInList = (costId, updates) => {
    setSharedCosts((prev) =>
      prev.map((item) =>
        item.id === costId ? { ...item, ...updates } : item
      )
    );
  };

  const handleSharedCostDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSharedCosts((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id);
        const newIndex = prev.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveSharedProduct = (index) => {
    setSharedProducts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveItemFromSharedProduct = (productIndex, itemId) => {
    setSharedProducts((prev) => {
      const updated = [...prev];
      updated[productIndex].items = updated[productIndex].items.filter(
        (item) => item.id !== itemId
      );
      return updated;
    });
    if (editingSharedProductItemKey === `${productIndex}-${itemId}`) {
      setEditingSharedProductItemKey(null);
    }
  };

  const handleUpdateSharedProductItem = (productIndex, itemId, updates) => {
    setSharedProducts((prev) => {
      const updated = [...prev];
      const itemIndex = updated[productIndex].items.findIndex(
        (i) => i.id === itemId
      );
      if (itemIndex >= 0) {
        updated[productIndex].items[itemIndex] = {
          ...updated[productIndex].items[itemIndex],
          ...updates,
        };
      }
      return updated;
    });
  };

  const handleSubmitSharedCosting = () => {
    if (!sharedCostingName.trim()) {
      toast.error("Please enter a name for the shared costing");
      return;
    }
    if (sharedProducts.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    // Generate preview
    let preview = `Shared Costing Template: ${sharedCostingName}\n`;
    preview += `Created: ${new Date().toISOString()}\n`;
    preview +=
      `Created By: ${user.firstname || ""} ${user.lastname || ""}`.trim() ||
      user.id;
    preview += `\n\n`;

    if (outputPercentage) {
      preview += `Output Percentage: ${outputPercentage}%\n`;
    }

    preview += `Shared Costs:\n`;
    sharedCosts.forEach((item, index) => {
      preview += `  ${index + 1}. Type: ${item.type}, Description: ${
        item.description
      }`;
      if (item.quantity) preview += `, Quantity: ${item.quantity}`;
      if (item.rate) preview += `, Rate: ${item.rate}`;
      if (item.other_type === "percentage")
        preview += `, Percentage: ${item.quantity}, PercentageBasis: ${item.percentage_basis}`;
      if (item.description_code)
        preview += `, DescriptionCode: ${item.description_code}`;
      if (item.account_head) preview += `, AccountHead: ${item.account_head}`;
      if (item.other_type) preview += `, InputType: ${item.other_type}`;
      preview += `\n`;
    });

    preview += `\nProducts in this shared costing:\n`;
    sharedProducts.forEach((product, index) => {
      preview += `  ${index + 1}. ${product.product.name} (${
        product.product.sku
      })`;
      if (product.multiple) preview += `, Units: ${product.multiple}`;
      preview += `\n`;
      if (product.items.length > 0) {
        preview += `     Product Specific Items:\n`;
        product.items.forEach((item, itemIndex) => {
          preview += `       ${itemIndex + 1}. Type: ${
            item.type
          }, Description: ${item.description}`;
          if (item.quantity) preview += `, Quantity: ${item.quantity}`;
          if (item.rawMaterialId)
            preview += `, RawMaterialId: ${item.rawMaterialId}`;
          if (item.rawMaterialSku)
            preview += `, RawMaterialSku: ${item.rawMaterialSku}`;
          preview += `\n`;
        });
      }
      preview += `\n`;
    });

    if (selectedTemplateByProduct) {
      preview += `\nTemplate By-Product:\n`;
      preview += `  ${selectedTemplateByProduct.name} (${
        selectedTemplateByProduct.sku ||
        selectedTemplateByProduct.item_code ||
        selectedTemplateByProduct.id
      })`;
      if (templateByProductQty)
        preview += `, Units: ${templateByProductQty}`;
      if (templateByProductUnitCost)
        preview += `, Unit Cost: ₦${templateByProductUnitCost}`;
      preview += `\n`;
      if (templateByProductItems.length > 0) {
        preview += `     Line items:\n`;
        templateByProductItems.forEach((item, itemIndex) => {
          preview += `       ${itemIndex + 1}. Type: ${item.type}, Description: ${
            item.description
          }`;
          if (item.quantity) preview += `, Quantity: ${item.quantity}`;
          if (item.rate) preview += `, Rate: ${item.rate}`;
          preview += `\n`;
        });
      }
      preview += `\n`;
    }

    // Create JSON structure for notes - only sharedCost and products
    const costingData = {
      output: outputPercentage,
      sharedCost: sharedCosts.map((item) => ({
        type: item.type,
        description: item.description,
        descriptionCode: item.description_code || "",
        accountHead: item.account_head || "",
        quantity: item.quantity
          ? typeof item.quantity === "string"
            ? parseFloat(item.quantity)
            : item.quantity
          : 0,
        rawMaterialId: item.raw_material_id || "",
        rawMaterialName: item.raw_material_name || "",
        rawMaterialSku: item.raw_material_sku || "",
        otherType: item.other_type || "",
        rate: item.rate || "",
        percentageBasis: item.percentage_basis || "",
      })),
      products: sharedProducts.map((p) => ({
        productId: p.product.id,
        productName: p.product.name,
        productSku: p.product.sku,
        units: p.multiple
          ? typeof p.multiple === "string"
            ? parseInt(p.multiple)
            : p.multiple
          : 0,
        items: p.items.map((item) => {
          const rateVal = item.rate || "";
          const unitCostVal =
            item.type === "raw_material" && rateVal
              ? parseFloat(String(rateVal).replace(/,/g, "")) || 0
              : undefined;
          return {
            type: item.type,
            description: item.description,
            descriptionCode: item.description_code || "",
            accountHead: item.account_head || "",
            quantity: item.quantity
              ? typeof item.quantity === "string"
                ? parseFloat(item.quantity)
                : item.quantity
              : 0,
            rawMaterialId: item.raw_material_id || "",
            rawMaterialName: item.raw_material_name || "",
            rawMaterialSku: item.raw_material_sku || "",
            otherType: item.other_type || "",
            rate: rateVal,
            ...(unitCostVal !== undefined && { unit_cost: unitCostVal }),
            percentageBasis: item.percentage_basis || "",
          };
        }),
      })),
      ...(selectedTemplateByProduct
        ? {
            templateByProduct: {
              productId: selectedTemplateByProduct.id,
              productName: selectedTemplateByProduct.name,
              productSku:
                selectedTemplateByProduct.sku ||
                selectedTemplateByProduct.item_code ||
                "",
              item_code:
                selectedTemplateByProduct.item_code ||
                selectedTemplateByProduct.sku ||
                "",
              units: (() => {
                const u = parseFloat(
                  String(templateByProductQty || "1").replace(/,/g, ""),
                );
                return Number.isFinite(u) && u > 0 ? u : 1;
              })(),
              unit_cost: (() => {
                const uc = parseFloat(
                  String(templateByProductUnitCost || "").replace(/,/g, ""),
                );
                return Number.isFinite(uc) && uc >= 0 ? uc : 0;
              })(),
              items: templateByProductItems.map((item) => {
                const rateVal = item.rate || "";
                const unitCostVal =
                  item.type === "raw_material" && rateVal
                    ? parseFloat(String(rateVal).replace(/,/g, "")) || 0
                    : undefined;
                return {
                  type: item.type,
                  description: item.description,
                  descriptionCode: item.description_code || "",
                  accountHead: item.account_head || "",
                  quantity: item.quantity
                    ? typeof item.quantity === "string"
                      ? parseFloat(item.quantity)
                      : item.quantity
                    : 0,
                  rawMaterialId: item.raw_material_id || "",
                  rawMaterialName: item.raw_material_name || "",
                  rawMaterialSku: item.raw_material_sku || "",
                  otherType: item.other_type || "",
                  rate: rateVal,
                  ...(unitCostVal !== undefined && { unit_cost: unitCostVal }),
                  percentageBasis: item.percentage_basis || "",
                };
              }),
            },
          }
        : {}),
    };

    // Convert to JSON string for notes field
    const notesJson = JSON.stringify(costingData, null, 2);

    // Also keep the text preview for backward compatibility
    // const notesText = `Shared Costing Template: ${sharedCostingName}\n${preview}`;
    // const combinedNotes = notesText + "\n\n--- JSON DATA ---\n" + notesJson;

    // Proceed with save
    setLoading(true);

    // Extract product IDs from sharedProducts array
    const baseProductIds = sharedProducts.map((p) => p.product.id);
    const tbpId = selectedTemplateByProduct?.id;
    const productIdArray =
      tbpId != null &&
      tbpId !== "" &&
      !baseProductIds.some((id) => String(id) === String(tbpId))
        ? [...baseProductIds, tbpId]
        : baseProductIds;

    // Determine if this is create or update based on whether we have an existing group ID
    // productIds can be a number (group ID) or empty string (for new groups)
    const isUpdate =
      productIds &&
      (typeof productIds === "number" ||
        (typeof productIds === "string" && productIds.trim() !== ""));
    const groupId = isUpdate
      ? typeof productIds === "number"
        ? productIds
        : parseInt(productIds)
      : null;

    const payload = {
      facilityId: activeBusiness.id,
      name: sharedCostingName,
      productIds: productIdArray, // Array of product IDs
      description: `Shared Costing Template: ${sharedCostingName}`,
      notes: notesJson,
    };

    // Use POST for create, PUT for update
    if (isUpdate) {
      // Update existing product group
      _putApi(
        `/api/product-groups/${groupId}`,
        payload,
        (response) => {
          if (response.success) {
            toast.success("Shared costing template updated successfully");
            loadTemplates();
            handleCancel();
          } else {
            toast.error(response.message || "Failed to update shared costing");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error updating shared costing:", error);
          toast.error("Error updating shared costing template");
          setLoading(false);
        }
      );
    } else {
      // Create new product group
      _postApi(
        `/api/product-groups`,
        payload,
        (response) => {
          if (response.success) {
            toast.success("Shared costing template created successfully");
            loadTemplates();
            handleCancel();
          } else {
            toast.error(response.message || "Failed to create shared costing");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error creating shared costing:", error);
          toast.error("Error creating shared costing template");
          setLoading(false);
        }
      );
    }
  };

  const handleEdit = (group) => {
    const productId = group.productId;
    const product = finishedGoodProducts.find((p) => p.id === productId);
    setEditingTemplate({ productId, productName: group.productName });
    setEditingProductId(productId);
    setEditingItemId(null);

    // Load all items (children) into itemList - exclude any item that is the product itself
    const productName = (group.productName || product?.name || "").trim();
    const items = (group.items || [])
      .filter((t) => {
        const desc = (t.description || t.raw_material_name || "").trim();
        return desc !== productName; // exclude product appearing as its own item
      })
      .map((t, idx) => ({
      id: t.id || `${productId}-${idx}`,
      finished_good_product_id: productId,
      type: t.type || "raw_material",
      description: t.description || t.raw_material_name || "",
      description_code: t.description_code || "",
      account_head: t.account_head || "",
      quantity: parseFloat(t.quantity) || 0,
      amount: parseFloat(t.amount) || 0,
      raw_material_id: t.raw_material_id || "",
      raw_material_name: t.raw_material_name || "",
      raw_material_sku: t.raw_material_sku || "",
      product_id: t.product_id || "",
      other_type: t.other_type || "",
      rate: t.rate != null ? String(t.rate) : "",
      percentage_basis: t.percentage_basis || "",
    }));
    setItemList(items);

    setForm({
      finished_good_product_id: productId,
      type: "",
      description: "",
      description_code: "",
      account_head: "",
      quantity: "",
      amount: "",
      raw_material_id: "",
      raw_material_name: "",
      raw_material_sku: "",
      product_id: "",
      other_type: "",
      rate: "",
      percentage_basis: "",
    });
    setSelectedProduct(product || null);
    setSelectedRawMaterial(null);
    setSelectedExpense(null);
    setCostingMode("single");
    setIsModalOpen(true);
  };

  // Add item to list
  const handleAddToList = () => {
    if (!form.finished_good_product_id) {
      toast.error("Please select a Finished Good product first");
      return;
    }

    if (!form.type) {
      toast.error("Type is required");
      return;
    }

    // Description is only required for non-ingredient types
    // (raw_material and semi_finished get description from selected item)
    if (
      form.type !== "raw_material" &&
      form.type !== "semi_finished" &&
      !form.description?.trim()
    ) {
      toast.error("Description is required");
      return;
    }

    if (form.type === "other" || form.type === "by_product_credit") {
      if (!form.account_head?.trim()) {
        toast.error("Account Head is required");
        return;
      }
      if (!form.other_type) {
        toast.error("Please select input type (Rate or Percentage)");
        return;
      }
      if (form.other_type === "rate") {
        const rateValue = form.rate ? String(form.rate).replace(/,/g, "") : "";
        const rateNum = parseFloat(rateValue);
        if (!rateValue || isNaN(rateNum) || rateNum <= 0) {
          toast.error("Rate must be greater than 0");
          return;
        }
      }
      if (
        form.other_type === "percentage" &&
        (!form.quantity ||
          parseFloat(form.quantity) <= 0 ||
          parseFloat(form.quantity) > 100)
      ) {
        toast.error("Percentage must be between 0 and 100");
        return;
      }
      if (form.other_type === "percentage" && !form.percentage_basis) {
        toast.error("Percentage Basis is required");
        return;
      }
    } else {
      if (!form.quantity || parseFloat(form.quantity) <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }
    }

    if (
      (form.type === "raw_material" || form.type === "semi_finished") &&
      !form.raw_material_id
    ) {
      toast.error(
        form.type === "semi_finished"
          ? "Please select a semi-finished item"
          : "Please select a raw material"
      );
      return;
    }

    const newItem = {
      id: Date.now(), // Temporary ID for list management
      finished_good_product_id: form.finished_good_product_id,
      type: form.type,
      description:
        form.type === "raw_material" || form.type === "semi_finished"
          ? form.raw_material_name
          : form.description,
      description_code: form.description_code || "",
      account_head: form.account_head || "",
      quantity: parseFloat(form.quantity) || 0,
      amount: parseFloat(form.amount) || 0,
      raw_material_id: form.raw_material_id || "",
      raw_material_name: form.raw_material_name || "",
      raw_material_sku: form.raw_material_sku || "",
      product_id: form.product_id || "",
      other_type: form.other_type || "",
      rate: form.rate ? String(form.rate).replace(/,/g, "") : "",
      percentage_basis: form.percentage_basis || "",
    };

    setItemList((prev) => [...prev, newItem]);

    // Reset form for next item (but keep the selected product).
    // For semi-finished costing, keep type locked to raw_material and re-seed defaults.
    const isSemi = costingMode === "semi_finished";
    setForm((prev) => ({
      ...prev,
      type: isSemi ? "raw_material" : "",
      description: "",
      description_code: "",
      account_head: "",
      quantity: isSemi ? "1" : "",
      amount: "",
      raw_material_id: "",
      raw_material_name: "",
      raw_material_sku: "",
      product_id: "",
      other_type: "",
      rate: isSemi ? "0" : "",
      percentage_basis: "",
    }));
    setSelectedRawMaterial(null);
    setSelectedExpense(null);
    toast.success("Item added to list");
  };

  // Remove item from list
  const handleRemoveFromList = (itemId) => {
    setItemList((prev) => prev.filter((item) => item.id !== itemId));
    setEditingItemId(null);
    toast.success("Item removed from list");
  };

  // Reorder items (drag-and-drop)
  const handleItemListDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setItemList((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id);
        const newIndex = prev.findIndex((item) => item.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  // Update item in list (for raw material cost/quantity edit)
  const handleUpdateItemInList = (itemId, updates, closeEdit = false) => {
    setItemList((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
    if (closeEdit) setEditingItemId(null);
  };

  // Update product costing items (when editing)
  const handleUpdateProductItems = () => {
    if (itemList.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    if (!editingProductId) return;

    // Semi-finished costing is persisted on the product's `notes` field —
    // delegate to the submit handler so we don't write to the
    // costing_templates table for this mode.
    if (
      costingMode === "semi_finished" ||
      templateProductType === "semi_finished"
    ) {
      handleSubmitList();
      return;
    }

    setLoading(true);
    const payload = {
      facilityId: activeBusiness.id,
      items: itemList.map((item) => ({
        type: item.type,
        description: item.description,
        description_code: item.description_code || "",
        account_head: item.account_head || "",
        quantity: item.quantity,
        amount: item.amount,
        raw_material_id: item.raw_material_id || "",
        raw_material_name: item.raw_material_name || "",
        raw_material_sku: item.raw_material_sku || "",
        product_id: item.product_id || "",
        other_type: item.other_type || "",
        rate: item.rate || "",
        percentage_basis: item.percentage_basis || "",
      })),
    };

    _putApi(
      `/api/costing-templates/product/${editingProductId}`,
      payload,
      (response) => {
        if (response.success) {
          toast.success("Costing template updated successfully");
          loadTemplates();
          handleCancel();
        } else {
          toast.error(response.message || "Failed to update");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error updating:", error);
        toast.error("Error updating costing template");
        setLoading(false);
      }
    );
  };

  // Submit all items from list (create)
  const handleSubmitList = () => {
    if (itemList.length === 0) {
      toast.error("Please add at least one item to the list");
      return;
    }

    const productId =
      itemList[0]?.finished_good_product_id || form.finished_good_product_id;

    // Semi-finished costing: persisted in semi_finished_costing_* tables (not product notes).
    if (costingMode === "semi_finished") {
      if (!productId) {
        toast.error("Please select a semi-finished product");
        return;
      }
      if (!editingSemiTemplateId) {
        const nm = (semiCostingTemplateName || "").trim();
        if (!nm) {
          toast.error("Please enter a template name");
          return;
        }
      }

      const body = {
        facilityId: activeBusiness.id,
        createdBy:
          `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.id,
        items: itemList.map((item) => {
          const rateVal = item.rate
            ? String(item.rate).replace(/,/g, "")
            : "";
          const unitCostVal = rateVal ? parseFloat(rateVal) || 0 : 0;
          return {
            type: item.type,
            description: item.description,
            description_code: item.description_code || "",
            account_head: item.account_head || "",
            quantity:
              typeof item.quantity === "string"
                ? parseFloat(item.quantity) || 0
                : item.quantity || 0,
            raw_material_id: item.raw_material_id || "",
            raw_material_name: item.raw_material_name || "",
            raw_material_sku: item.raw_material_sku || "",
            other_type: item.other_type || "",
            rate: rateVal,
            unit_cost: unitCostVal,
            percentage_basis: item.percentage_basis || "",
          };
        }),
      };
      if (editingSemiTemplateId) {
        body.template_id = editingSemiTemplateId;
      } else {
        body.template_name = (semiCostingTemplateName || "Default").trim();
      }
      if (semiCostingIsDefault) {
        body.is_default = true;
      }

      setLoading(true);
      _putApi(
        `/api/semi-finished-costing/product/${productId}`,
        body,
        (response) => {
          if (response.success) {
            toast.success("Semi-finished costing saved");
            loadSemiFinishedProducts();
            loadTemplates();
            handleCancel();
          } else {
            toast.error(
              response.message || "Failed to save semi-finished costing",
            );
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error saving semi-finished costing:", error);
          toast.error("Error saving semi-finished costing");
          setLoading(false);
        },
      );
      return;
    }

    setLoading(true);
    const payload = {
      facilityId: activeBusiness.id,
      createdBy:
        `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.id,
      finished_good_product_id: productId,
      items: itemList.map((item) => ({
        type: item.type,
        description: item.description,
        description_code: item.description_code || "",
        account_head: item.account_head || "",
        quantity: item.quantity,
        amount: item.amount,
        raw_material_id: item.raw_material_id,
        raw_material_name: item.raw_material_name,
        raw_material_sku: item.raw_material_sku,
        product_id: item.product_id,
        other_type: item.other_type || "",
        rate: item.rate || "",
        percentage_basis: item.percentage_basis || "",
      })),
    };

    _postApi(
      "/api/costing-templates/bulk",
      payload,
      (response) => {
        if (response.success) {
          toast.success(
            `${itemList.length} costing template(s) created successfully`
          );
          loadTemplates();
          handleCancel();
        } else {
          toast.error(response.message || "Failed to save templates");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error saving templates:", error);
        toast.error("Error saving costing templates");
        setLoading(false);
      },
      "POST"
    );
  };

  // Handle save for editing (single item)
  const handleSave = () => {
    if (!form.finished_good_product_id) {
      toast.error("Please select a Finished Good product");
      return;
    }

    if (!form.type) {
      toast.error("Type is required");
      return;
    }

    // For "other" or "by_product_credit" type, account_head and description are required
    if (form.type === "other" || form.type === "by_product_credit") {
      if (!form.account_head?.trim()) {
        toast.error("Account Head is required");
        return;
      }
      if (!form.description?.trim()) {
        toast.error("Description is required");
        return;
      }
      if (!form.other_type) {
        toast.error("Please select input type (Rate or Percentage)");
        return;
      }
      if (
        form.other_type === "rate" &&
        (!form.rate || parseFloat(form.rate) <= 0)
      ) {
        toast.error("Rate must be greater than 0");
        return;
      }
      if (
        form.other_type === "percentage" &&
        (!form.quantity ||
          parseFloat(form.quantity) <= 0 ||
          parseFloat(form.quantity) > 100)
      ) {
        toast.error("Percentage must be between 0 and 100");
        return;
      }
      if (form.other_type === "percentage" && !form.percentage_basis) {
        toast.error("Please select percentage basis");
        return;
      }
    } else {
      if (!form.quantity || parseFloat(form.quantity) <= 0) {
        toast.error("Quantity must be greater than 0");
        return;
      }
    }

    if (
      (form.type === "raw_material" || form.type === "semi_finished") &&
      !form.raw_material_id
    ) {
      toast.error(
        form.type === "semi_finished"
          ? "Please select a semi-finished item"
          : "Please select a raw material"
      );
      return;
    }

    setLoading(true);
    const payload = {
      facilityId: activeBusiness.id,
      createdBy:
        `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.id,
      finished_good_product_id: form.finished_good_product_id,
      ...form,
      description_code: form.description_code || "",
      account_head: form.account_head || "",
      amount: parseFloat(form.amount) || 0,
      quantity: parseFloat(form.quantity) || 0,
      rate: form.rate ? parseFloat(form.rate) : 0,
      percentage_basis: form.percentage_basis || "",
    };

    const url = `/api/costing-templates/${editingTemplate.id}`;
    const method = "PUT";

    _postApi(
      url,
      payload,
      (response) => {
        if (response.success) {
          toast.success("Costing template updated successfully");
          loadTemplates();
          handleCancel();
        } else {
          toast.error(response.message || "Failed to save template");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error saving template:", error);
        toast.error("Error saving costing template");
        setLoading(false);
      },
      method
    );
  };

  const handleCancel = () => {
    setEditingTemplate(null);
    setEditingProductId(null);
    setEditingSharedGroupId(null);
    setEditingItemId(null);
    setEditingSharedCostId(null);
    setEditingSharedProductItemKey(null);
    setSelectedRawMaterial(null);
    setSelectedProduct(null);
    setSelectedExpense(null);
    setItemList([]);
    setCostingMode("single");
    setSharedCostingName("");
    setSharedCosts([]);
    setSharedProducts([]);
    setActiveSharedProductIndex(null);
    setOutputPercentage("");
    setSelectedTemplateByProduct(null);
    setTemplateByProductQty("1");
    setTemplateByProductUnitCost("");
    setTemplateByProductItems([]);
    setUnits("");
    setEditingSemiTemplateId(null);
    setSemiCostingTemplateName("Default");
    setSemiCostingIsDefault(false);
    setIsModalOpen(false);
    setValuationCostHint("");
    setForm({
      finished_good_product_id: "",
      type: "",
      description: "",
      description_code: "",
      account_head: "",
      quantity: "",
      amount: "",
      raw_material_id: "",
      raw_material_name: "",
      raw_material_sku: "",
      product_id: "",
      other_type: "",
      rate: "",
      percentage_basis: "",
    });
  };

  const handleDeleteSemiTemplate = (group) => {
    if (!group.templateId) {
      toast.error(
        "This row is from legacy product notes. Save once as a named template to enable delete from here.",
      );
      return;
    }
    if (
      !window.confirm(
        `Delete costing template "${group.templateName}" for ${group.productName}?`,
      )
    ) {
      return;
    }
    setLoading(true);
    _postApi(
      `/api/semi-finished-costing/template/${group.templateId}?facilityId=${activeBusiness.id}`,
      {},
      (response) => {
        if (response.success) {
          toast.success("Template deleted");
          loadSemiFinishedProducts();
        } else {
          toast.error(response.message || "Failed to delete template");
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error deleting semi template:", error);
        toast.error("Error deleting template");
        setLoading(false);
      },
      "DELETE",
    );
  };

  const handleDelete = (template) => {
    if (
      window.confirm(
        `Are you sure you want to delete the template "${template.description}"?`
      )
    ) {
      setLoading(true);
      _postApi(
        `/api/costing-templates/${template.id}?facilityId=${activeBusiness.id}`,
        {},
        (response) => {
          if (response.success) {
            toast.success("Template deleted successfully");
            loadTemplates();
          } else {
            toast.error(response.message || "Failed to delete template");
          }
          setLoading(false);
        },
        (error) => {
          console.error("Error deleting template:", error);
          toast.error("Error deleting template");
          setLoading(false);
        },
        "DELETE"
      );
    }
  };

  const handleDeleteGroup = (group) => {
    const itemCount = group.items.length;
    if (
      window.confirm(
        `Are you sure you want to delete the entire template for "${group.productName}" (${itemCount} item${itemCount !== 1 ? "s" : ""})?`
      )
    ) {
      setLoading(true);
      let completed = 0;
      let hasError = false;

      group.items.forEach((template) => {
        _postApi(
          `/api/costing-templates/${template.id}?facilityId=${activeBusiness.id}`,
          {},
          (response) => {
            completed++;
            if (!response.success) hasError = true;
            if (completed === itemCount) {
              if (hasError) {
                toast.error("Some items failed to delete");
              } else {
                toast.success("Template deleted successfully");
              }
              loadTemplates();
              setLoading(false);
            }
          },
          (error) => {
            completed++;
            hasError = true;
            console.error("Error deleting template item:", error);
            if (completed === itemCount) {
              toast.error("Error deleting template");
              loadTemplates();
              setLoading(false);
            }
          },
          "DELETE"
        );
      });
    }
  };

  // Set of semi-finished product IDs for quick lookup
  const semiFinishedIds = useMemo(
    () => new Set(semiFinishedProducts.map((p) => String(p.id))),
    [semiFinishedProducts]
  );

  // Job / Specific Costing: templates linked to Finished Good products
  const jobGroupedTemplates = useMemo(() => {
    const grouped = {};
    const singleTemplates = templates.filter((t) => !t.is_shared);

    singleTemplates.forEach((template) => {
      const productId = template.finished_good_product_id || template.product_id;
      if (!productId) return;
      if (semiFinishedIds.has(String(productId))) return; // skip semi-finished

      if (!grouped[productId]) {
        const product = finishedGoodProducts.find((p) => p.id === productId);
        grouped[productId] = {
          productId,
          productName: product?.name || "Unknown Product",
          productSku: product?.sku || "",
          items: [],
          isShared: false,
        };
      }
      grouped[productId].items.push(template);
    });

    return Object.values(grouped);
  }, [templates, finishedGoodProducts, semiFinishedIds]);

  // Semi-finished Costing: multiple named templates per product in DB; legacy `notes` fallback.
  const semiGroupedTemplates = useMemo(() => {
    const grouped = [];

    const mapItemsToRows = (product, items, source, notesData, meta = {}) => {
      if (!items?.length) return;
      const templateId = meta.templateId ?? null;
      const templateName = meta.templateName ?? "Default";
      const isDefaultRecipe = meta.isDefaultRecipe ?? false;
      const rowKey =
        meta.rowKey ?? `${product.id}-${templateId || source || "legacy"}`;
      grouped.push({
        rowKey,
        templateId,
        templateName,
        isDefaultRecipe,
        productId: product.id,
        productName: product.name || "Unknown Product",
        productSku: product.sku || "",
        items: items.map((it, idx) => ({
          id: `${product.id}-${templateId || "noid"}-${idx}`,
          finished_good_product_id: product.id,
          product_id: product.id,
          type: it.type || "raw_material",
          description:
            it.description || it.rawMaterialName || it.raw_material_name || "",
          description_code:
            it.descriptionCode || it.description_code || "",
          account_head: it.accountHead || it.account_head || "",
          quantity: it.quantity ?? 0,
          rate: it.rate ?? "",
          unit_cost: it.unit_cost ?? 0,
          raw_material_id: it.rawMaterialId || it.raw_material_id || "",
          raw_material_name: it.rawMaterialName || it.raw_material_name || "",
          raw_material_sku: it.rawMaterialSku || it.raw_material_sku || "",
          other_type: it.otherType || it.other_type || "",
          percentage_basis: it.percentageBasis || it.percentage_basis || "",
        })),
        notesData: notesData || null,
        isShared: false,
        source,
      });
    };

    semiFinishedProducts.forEach((product) => {
      const fromTemplates = product.semi_finished_costing_templates;
      if (Array.isArray(fromTemplates) && fromTemplates.length > 0) {
        fromTemplates.forEach((tpl, idx) => {
          const items = Array.isArray(tpl.items) ? tpl.items : [];
          mapItemsToRows(
            product,
            items,
            "semi_finished_costing_table",
            { kind: "semi_finished_costing", items },
            {
              templateId: tpl.template_id,
              templateName: tpl.template_name || "Default",
              isDefaultRecipe: !!tpl.is_default,
              rowKey: `${product.id}-${tpl.template_id || idx}`,
            },
          );
        });
        return;
      }

      const fromDb = product.semi_finished_costing_items;
      if (Array.isArray(fromDb) && fromDb.length > 0) {
        mapItemsToRows(
          product,
          fromDb,
          "semi_finished_costing_table",
          { kind: "semi_finished_costing", items: fromDb },
          {
            templateId: null,
            templateName: "Default",
            isDefaultRecipe: true,
            rowKey: `${product.id}-legacy-items`,
          },
        );
        return;
      }

      if (!product?.notes) return;

      let parsed = null;
      try {
        const raw =
          typeof product.notes === "string"
            ? product.notes.trim()
            : product.notes;
        if (!raw) return;
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (err) {
        return;
      }

      if (!parsed || parsed.kind !== "semi_finished_costing") return;
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      mapItemsToRows(product, items, "product_notes", parsed, {
        templateId: null,
        templateName: parsed.templateName || "Notes",
        isDefaultRecipe: false,
        rowKey: `${product.id}-notes`,
      });
    });

    return grouped;
  }, [semiFinishedProducts]);

  // JOINT / SHARED COST ALLOCATION: templates from product groups (ProductGroup model)
  const sharedGroupedTemplates = useMemo(() => {
    const grouped = {};
    const sharedTemplates = templates.filter((t) => t.is_shared);

    sharedTemplates.forEach((template) => {
      const sharedId = `shared-${template.product_id}`;
      grouped[sharedId] = {
        productId: sharedId,
        productName: `${template.description} (Shared Costing)`,
        productSku: "SHARED",
        items: [template],
        isShared: true,
        groupData: {
          ...template.group_data,
          costing_data: template.costing_data,
        },
      };
    });

    return Object.values(grouped);
  }, [templates]);

  const renderSharedProductAddItemPanel = (targetIndex) => {
    const isTemplateByProductLine =
      targetIndex === TEMPLATE_BY_PRODUCT_LINE_INDEX;
    if (activeSharedProductIndex !== targetIndex) {
      return (
                            <button
                              onClick={() => {
                                setActiveSharedProductIndex(targetIndex);
                                resetFormForShared();
                              }}
                              className="w-full py-2 px-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                            >
                              <Plus size={16} /> Add Item
                            </button>
      );
    }
    return (
                            <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50">
                              <div className="space-y-3">
                                {/* Ingredient Selection - Full Width */}
                                {(form.type === "raw_material" ||
                                  form.type === "semi_finished") && (
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      {form.type === "semi_finished"
                                        ? "Semi Finished"
                                        : "Raw Material"}{" "}
                                      <span className="text-red-500">*</span>
                                    </label>
                                    {form.type === "semi_finished" ? (
                                      <TypeaheadCustom
                                        options={semiFinishedProducts}
                                        placeholder="Select semi-finished item..."
                                        labelKey={(p) => `${p.name} (${p.sku || p.id})`}
                                        onChange={(sel) => {
                                          const s = sel[0];
                                          setSelectedSemiFinishedItem(s || null);
                                          if (s) {
                                            handleInputChange("raw_material_id", s.id);
                                            handleInputChange("raw_material_name", s.name);
                                            handleInputChange(
                                              "raw_material_sku",
                                              s.sku || s.id
                                            );
                                            if (s.cost_price != null && !form.rate) {
                                              handleInputChange(
                                                "rate",
                                                String(s.cost_price)
                                              );
                                            }
                                          }
                                        }}
                                        selected={
                                          selectedSemiFinishedItem
                                            ? [selectedSemiFinishedItem]
                                            : []
                                        }
                                      />
                                    ) : (
                                      <TypeaheadCustom
                                        options={rawMaterials}
                                        placeholder="Select raw material..."
                                        labelKey={(m) => `${m.name} (${m.sku})`}
                                        onChange={(sel) => {
                                          const s = sel[0];
                                          setSelectedRawMaterial(s || null);
                                          if (s) {
                                            handleInputChange("raw_material_id", s.id);
                                            handleInputChange("raw_material_name", s.name);
                                            handleInputChange("raw_material_sku", s.sku);
                                            if (s.cost_price != null && !form.rate) {
                                              handleInputChange(
                                                "rate",
                                                String(s.cost_price)
                                              );
                                            }
                                          }
                                        }}
                                        selected={
                                          selectedRawMaterial
                                            ? [selectedRawMaterial]
                                            : []
                                        }
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Account Head Selection - Only for by-product/other */}
                                {(form.type === "other" ||
                                  form.type === "by_product_credit") && (
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      Account Head{" "}
                                      <span className="text-red-500">*</span>
                                    </label>
                                    <Typeahead
                                      id={`account-head-${targetIndex}`}
                                      labelKey={(option) =>
                                        `${option.code} ${option.name}`
                                      }
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
                                      options={expenseList || []}
                                      placeholder="Select account head..."
                                      onChange={(selectedItems) => {
                                        if (selectedItems.length) {
                                          const expense = selectedItems[0];
                                          setSelectedExpense(expense);
                                          handleInputChange(
                                            "account_head",
                                            expense.name || ""
                                          );
                                          handleInputChange(
                                            "description_code",
                                            expense.code || ""
                                          );
                                          handleInputChange(
                                            "description",
                                            expense.name || ""
                                          );
                                        } else {
                                          setSelectedExpense(null);
                                          handleInputChange("account_head", "");
                                          handleInputChange(
                                            "description_code",
                                            ""
                                          );
                                          handleInputChange("description", "");
                                        }
                                      }}
                                      selected={
                                        form.account_head && selectedExpense
                                          ? expenseList.filter(
                                              (expense) =>
                                                expense.code ===
                                                  form.description_code &&
                                                expense.name ===
                                                  form.account_head
                                            )
                                          : []
                                      }
                                      clearButton
                                      allowNew={false}
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
                                          e.target.style.borderColor =
                                            "rgb(34 197 94)";
                                          e.target.style.boxShadow =
                                            "0 0 0 3px rgba(34, 197, 94, 0.1)";
                                        },
                                        onBlur: (e) => {
                                          e.target.style.borderColor =
                                            "rgb(203 213 225)";
                                          e.target.style.boxShadow = "none";
                                        },
                                      }}
                                      positionFixed={true}
                                    />
                                  </div>
                                )}

                                {/* Three/Four Column Layout: Type, Description, Input, Cost (for raw material) */}
                                <div
                                  className={`grid gap-2 ${
                                    form.type === "raw_material" ||
                                    form.type === "semi_finished"
                                      ? "grid-cols-4"
                                      : "grid-cols-3"
                                  }`}
                                >
                                  {/* Type Selection */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      Type
                                    </label>
                                    <Select
                                      value={form.type}
                                      onValueChange={(v) => {
                                        handleInputChange("type", v);
                                        // Reset related fields when type changes
                                        if (
                                          v === "raw_material" ||
                                          v === "semi_finished"
                                        ) {
                                          setSelectedRawMaterial(null);
                                          setSelectedSemiFinishedItem(null);
                                          handleInputChange(
                                            "raw_material_id",
                                            ""
                                          );
                                          handleInputChange(
                                            "raw_material_name",
                                            ""
                                          );
                                          handleInputChange(
                                            "raw_material_sku",
                                            ""
                                          );
                                          handleInputChange("other_type", "");
                                          handleInputChange("rate", "");
                                          handleInputChange(
                                            "percentage_basis",
                                            ""
                                          );
                                          setSelectedExpense(null);
                                          handleInputChange("account_head", "");
                                          handleInputChange(
                                            "description_code",
                                            ""
                                          );
                                          handleInputChange("description", "");
                                        } else if (
                                          v === "other" ||
                                          v === "by_product_credit"
                                        ) {
                                          setSelectedRawMaterial(null);
                                          handleInputChange(
                                            "raw_material_id",
                                            ""
                                          );
                                          handleInputChange(
                                            "raw_material_name",
                                            ""
                                          );
                                          handleInputChange(
                                            "raw_material_sku",
                                            ""
                                          );
                                          handleInputChange("quantity", "");
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="raw_material">
                                          Raw Material
                                        </SelectItem>
                                        <SelectItem value="semi_finished">
                                          Semi Finished
                                        </SelectItem>
                                        {!isTemplateByProductLine && (
                                          <SelectItem value="by_product_credit">
                                            By-product
                                          </SelectItem>
                                        )}
                                        <SelectItem value="other">
                                          Other
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Description Input */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      Description
                                    </label>
                                    {form.type === "raw_material" ||
                                    form.type === "semi_finished" ? (
                                      <Input
                                        type="text"
                                        value={form.raw_material_name || ""}
                                        disabled
                                        className="h-9 bg-gray-100"
                                        placeholder={
                                          form.type === "semi_finished"
                                            ? "Select semi-finished item first"
                                            : "Select raw material first"
                                        }
                                      />
                                    ) : (
                                      <Input
                                        type="text"
                                        value={form.description}
                                        onChange={(e) =>
                                          handleInputChange(
                                            "description",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Description"
                                        className="h-9"
                                      />
                                    )}
                                  </div>

                                  {/* Input: Qty for raw material, Rate/Percentage for other */}
                                  <div>
                                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                                      {form.type === "raw_material" ||
                                      form.type === "semi_finished"
                                        ? "Qty"
                                        : "Input"}
                                    </label>
                                    {form.type === "raw_material" ||
                                    form.type === "semi_finished" ? (
                                      <Input
                                        type="number"
                                        value={form.quantity || ""}
                                        onChange={(e) =>
                                          handleInputChange(
                                            "quantity",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Qty"
                                        min={0}
                                        step="0.0001"
                                        className="h-9"
                                      />
                                    ) : (
                                      <Select
                                        value={form.other_type}
                                        onValueChange={(v) => {
                                          handleInputChange("other_type", v);
                                          // Reset rate/quantity when switching input types
                                          if (v === "rate") {
                                            handleInputChange("quantity", "");
                                            handleInputChange(
                                              "percentage_basis",
                                              ""
                                            );
                                          } else if (v === "percentage") {
                                            handleInputChange("rate", "");
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Input" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="rate">
                                            Rate
                                          </SelectItem>
                                          <SelectItem value="percentage">
                                            Percentage
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>

                                  {/* Cost (₦) - for ingredient types */}
                                  {(form.type === "raw_material" ||
                                    form.type === "semi_finished") && (
                                    <div>
                                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                                        Cost (₦)
                                      </label>
                                      <Input
                                        type="text"
                                        value={formatNumberWithCommas(
                                          form.rate || ""
                                        )}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(
                                            /[,]/g,
                                            ""
                                          );
                                          handleInputChange("rate", val);
                                        }}
                                        placeholder="0.00"
                                        className="h-9"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Additional Fields for Rate/Percentage - Show below the three columns */}
                                {(form.type === "other" ||
                                  form.type === "by_product_credit") &&
                                  form.other_type && (
                                    <div className="grid grid-cols-2 gap-2">
                                      {form.other_type === "rate" && (
                                        <div>
                                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                                            Rate (₦){" "}
                                            <span className="text-red-500">
                                              *
                                            </span>
                                          </label>
                                          <Input
                                            type="text"
                                            value={form.rate}
                                            onChange={(e) =>
                                              handleInputChange(
                                                "rate",
                                                e.target.value
                                              )
                                            }
                                            placeholder="0.00"
                                            className="h-9"
                                          />
                                        </div>
                                      )}
                                      {form.other_type === "percentage" && (
                                        <>
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                              Percentage (%){" "}
                                              <span className="text-red-500">
                                                *
                                              </span>
                                            </label>
                                            <Input
                                              type="text"
                                              value={form.quantity}
                                              onChange={(e) =>
                                                handleInputChange(
                                                  "quantity",
                                                  e.target.value
                                                )
                                              }
                                              placeholder="0.00"
                                              className="h-9"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                                              Percentage Basis{" "}
                                              <span className="text-red-500">
                                                *
                                              </span>
                                            </label>
                                            <Select
                                              value={form.percentage_basis}
                                              onValueChange={(v) =>
                                                handleInputChange(
                                                  "percentage_basis",
                                                  v
                                                )
                                              }
                                            >
                                              <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select basis" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="raw_material">
                                                  Raw Material Only
                                                </SelectItem>
                                                <SelectItem value="all_items">
                                                  All Items Above
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                                    onClick={() =>
                                      handleAddItemToSharedProduct(targetIndex)
                                    }
                                  >
                                    <Check size={14} /> Add
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-gray-700"
                                    onClick={() => {
                                      setActiveSharedProductIndex(null);
                                      resetFormForShared();
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
    );
  };


  return (
    <Card className="h-100 shadow-sm border-0">
      {/* Card Header */}
      <div
        className="card-header border-0 text-white position-relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${
            activeBusiness?.primary_color || "#007bff"
          } 0%, ${activeBusiness?.primary_color || "#007bff"}dd 100%)`,
          padding: "1rem",
        }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: "1.5rem" }}>📋</span>
            <div>
              <h5 className="mb-0 fw-bold">Costing Templates</h5>
              <small className="opacity-75">
                Manage costing templates for Job/Product Costing
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Button
              color="primary"
              onClick={handleCreate}
              className=""
              size="sm"
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>
      </div>

      <div className="card-body p-0">
        {loading && !templates.length ? (
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-5">
            <FileText size={48} className="text-muted mb-3" />
            <h5 className="text-muted">No costing templates found</h5>
            <p className="text-muted mb-3">
              Get started by creating your first costing template
            </p>
            <Button color="primary" onClick={handleCreate}>
              Create First Template
            </Button>
          </div>
        ) : (
          <div className="p-4">
            {/* Section 1: Job / Specific Costing (from products) */}
            <div className="mb-4">
              <h6 className="text-uppercase fw-bold text-muted mb-3 px-2">
                Job / Specific Costing
              </h6>
              <p className="text-muted small mb-3 px-2">
                Costing templates for individual products (from Products)
              </p>
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "30px" }}></th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="text-center">Items</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                    {jobGroupedTemplates.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-muted">
                          No job/specific costing templates. Create one with the + button above.
                        </td>
                      </tr>
                    ) : (
                      jobGroupedTemplates.map((group) => (
                    <Fragment key={group.productId}>
                      {/* Product Group Row */}
                      <tr className="bg-light">
                        <td></td>
                        <td>
                          <div className="fw-bold d-flex align-items-center gap-2">
                            {group.productName}
                            {group.isShared && (
                              <span className="badge bg-primary">Shared</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <small className="text-muted">
                            {group.productSku}
                          </small>
                        </td>
                        <td className="text-center">
                          {group.isShared ? (
                            <span className="badge bg-success">
                              {group.groupData?.products?.length || 0} products
                            </span>
                          ) : (
                            <span className="badge bg-info">
                              {group.items.length} item
                              {group.items.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </td>
                        <td>
                          {!group.isShared && group.items.length > 0 && (
                          <div className="d-flex gap-1 justify-content-center">
                            <Button
                              size="sm"
                              color="outline-primary"
                                onClick={() => handleEdit(group)}
                                disabled={loading}
                                title="Edit template"
                              >
                                <Edit size={14} />
                              </Button>
                          </div>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                    )) )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 2: SEMI-FINISHED COSTING */}
            <div className="mb-4">
              <div className="d-flex align-items-center justify-content-between px-2 mb-2">
                <div>
                  <h6 className="text-uppercase fw-bold mb-1" >
                    Semi-finished Product Costing
                  </h6>
                  <p className="text-muted small mb-0">
                    Costing templates for semi-finished products (WIP)
                  </p>
                </div>

              </div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead style={{ backgroundColor: "#4267B2" + "18" }}>
                    <tr>
                      <th style={{ width: "30px" }}></th>
                      <th>Product</th>
                      <th>Template</th>
                      <th>SKU</th>
                      <th className="text-center">Items</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semiGroupedTemplates.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4 text-muted">
                          No semi-finished costing templates yet. Click <strong>New</strong> to create one.
                        </td>
                      </tr>
                    ) : (
                      semiGroupedTemplates.map((group) => (
                        <Fragment key={group.rowKey}>
                          <tr style={{ backgroundColor: "#4267B2" + "0a" }}>
                            <td></td>
                            <td>
                              <div className="fw-bold d-flex align-items-center gap-2 flex-wrap">
                                {group.productName}
                                <span className="badge" style={{ backgroundColor: "#4267B2", fontSize: "0.7rem" }}>
                                  Semi-finished
                                </span>
                                {group.isDefaultRecipe && (
                                  <span className="badge bg-success" style={{ fontSize: "0.65rem" }}>
                                    Default
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="fw-semibold">{group.templateName}</span>
                              {!group.templateId && (
                                <div>
                                  <small className="text-muted">(legacy / notes)</small>
                                </div>
                              )}
                            </td>
                            <td>
                              <small className="text-muted">{group.productSku}</small>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-info">
                                {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                              </span>
                            </td>
                            <td className="text-center">
                              <Button
                                size="sm"
                                color="link"
                                className="p-0 me-2"
                                onClick={() => {
                                  setCostingMode("semi_finished");
                                  setTemplateProductType("semi_finished");
                                  setEditingProductId(group.productId);
                                  setEditingSemiTemplateId(group.templateId);
                                  setSemiCostingTemplateName(group.templateName || "Default");
                                  setSemiCostingIsDefault(!!group.isDefaultRecipe);
                                  setEditingTemplate({
                                    productId: group.productId,
                                    productName: group.productName,
                                  });
                                  setItemList(
                                    group.items.map((it, idx) => ({
                                      id: Date.now() + idx,
                                      finished_good_product_id: group.productId,
                                      type: it.type || "raw_material",
                                      description:
                                        it.description ||
                                        it.raw_material_name ||
                                        "",
                                      description_code:
                                        it.description_code || "",
                                      account_head: it.account_head || "",
                                      quantity:
                                        typeof it.quantity === "number"
                                          ? it.quantity
                                          : parseFloat(it.quantity) || 0,
                                      amount: 0,
                                      raw_material_id:
                                        it.raw_material_id || "",
                                      raw_material_name:
                                        it.raw_material_name || "",
                                      raw_material_sku:
                                        it.raw_material_sku || "",
                                      product_id: group.productId,
                                      other_type: it.other_type || "",
                                      rate: it.rate
                                        ? String(it.rate)
                                        : it.unit_cost
                                        ? String(it.unit_cost)
                                        : "",
                                      percentage_basis:
                                        it.percentage_basis || "",
                                    }))
                                  );
                                  const product = semiFinishedProducts.find(
                                    (p) => p.id === group.productId
                                  );
                                  setSelectedProduct(product || null);
                                  setForm((prev) => ({
                                    ...prev,
                                    finished_good_product_id: group.productId,
                                    type: "raw_material",
                                    quantity: prev.quantity || "1",
                                    rate: prev.rate || "0",
                                  }));
                                  setIsModalOpen(true);
                                }}
                                title="Edit template items"
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                size="sm"
                                color="link"
                                className="p-0 text-danger"
                                onClick={() => handleDeleteSemiTemplate(group)}
                                disabled={loading}
                                title="Delete this template"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </td>
                          </tr>
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: JOINT / SHARED COST ALLOCATION (from product groups) */}
            <div>
              <h6 className="text-uppercase fw-bold text-muted mb-3 px-2">
                JOINT / SHARED COST ALLOCATION
              </h6>
              <p className="text-muted small mb-3 px-2">
                Cost allocation for shared costs across multiple products (from Product Groups)
              </p>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "30px" }}></th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th className="text-center">Items</th>
                                    <th className="text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                    {sharedGroupedTemplates.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-muted">
                          No joint/shared cost allocation templates. Create one with the + button above.
                                                  </td>
                      </tr>
                    ) : (
                      sharedGroupedTemplates.map((group) => (
                          <Fragment key={group.productId}>
                            {/* Product Group Row */}
                            <tr className="bg-light">
                                                  <td></td>
                              <td>
                                <div className="fw-bold d-flex align-items-center gap-2">
                                  {group.productName}
                                  {group.isShared && (
                                    <span className="badge bg-primary">Shared</span>
                                  )}
                                </div>
                                              </td>
                                              <td>
                                                <small className="text-muted">
                                  {group.productSku}
                                                </small>
                                              </td>
                                              <td className="text-center">
                                {group.isShared ? (
                                  <span className="badge bg-success">
                                    {group.groupData?.products?.length || 0} products
                                                  </span>
                                                ) : (
                                  <span className="badge bg-info">
                                    {group.items.length} item
                                    {group.items.length !== 1 ? "s" : ""}
                                                  </span>
                                                )}
                                              </td>
                              <td>
                                {group.isShared && (
                                            <div className="d-flex gap-1 justify-content-center">
                                              <Button
                                                size="sm"
                                                color="outline-primary"
                                                onClick={() =>
                                        handleEditShared(group)
                                                }
                                                disabled={loading}
                                      title="Edit shared costing"
                                              >
                                                <Edit size={14} />
                                              </Button>
                                            </div>
                                )}
                                          </td>
                                        </tr>
                          </Fragment>
                        ))
                      )}
              </tbody>
            </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div
            className={`bg-white rounded-lg shadow-xl ${
              costingMode === "shared" ? "max-w-6xl" : "max-w-5xl"
            } w-full max-h-[90vh] overflow-hidden flex flex-col`}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">
                    {editingSharedGroupId
                      ? "Edit Costing Template"
                      : editingProductId
                      ? "Edit Costing Template"
                      : editingTemplate
                      ? "Edit Costing Template"
                      : "Create Costing Template"}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {editingSharedGroupId
                      ? `Update shared cost allocation for ${sharedCostingName || "multiple products"}`
                      : editingProductId
                      ? `Edit items for ${editingTemplate?.productName || ""}`
                      : editingTemplate
                      ? "Update costing template details"
                      : costingMode === "shared"
                      ? "Create joint/shared cost allocation for multiple products"
                      : "Add new costing template to your list"}
                  </p>
                </div>
                <button
                  onClick={handleCancel}
                  className="p-1.5 hover:bg-white/20 rounded transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Costing Mode Selector - Only show when creating new (not editing) */}
            {!editingTemplate && !editingSharedGroupId && (
              <div className="p-4 border-b bg-gray-50">
                <Label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Select Costing Type
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      mode: "single",
                      label: "Job / Specific Costing",
                      desc: "Single product with specific raw materials and costs",
                    },
                    {
                      mode: "semi_finished",
                      label: "Semi-finished Product Costing",
                      desc: "Semi-finished product with specific raw materials and costs",
                    },
                    {
                      mode: "shared",
                      label: "Joint / Shared Cost Allocation",
                      desc: "Multiple products sharing common costs",
                    },
                  ].map(({ mode, label, desc }) => {
                    const active = costingMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          // Switching mode should always start with a clean slate
                          setEditingTemplate(null);
                          setEditingProductId(null);
                          setEditingSharedGroupId(null);
                          setEditingSemiTemplateId(null);
                          setSemiCostingTemplateName("Default");
                          setSemiCostingIsDefault(false);
                          setCostingMode(mode);
                          setTemplateProductType(
                            mode === "semi_finished"
                              ? "semi_finished"
                              : "finished_good",
                          );
                          if (mode === "shared") {
                            setSelectedTemplateByProduct(null);
                            setTemplateByProductQty("1");
                            setTemplateByProductUnitCost("");
                            setTemplateByProductItems([]);
                            setActiveSharedProductIndex(null);
                            setOutputPercentage("");
                          }
                          handleInputChange("type", "");
                          setSelectedProduct(null);
                          handleInputChange("finished_good_product_id", "");
                          if (mode === "semi_finished") {
                            // semi-finished templates are always raw material type with default rate/quantity
                            setForm((prev) => ({
                              ...prev,
                              type: "raw_material",
                              rate: prev.rate === "" ? "0" : prev.rate,
                              quantity: prev.quantity === "" ? "1" : prev.quantity,
                            }));
                            setSelectedRawMaterial(null);
                          } else {
                            handleInputChange("type", "");
                          }
                        }}
                        className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                          active
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                              active ? "border-blue-500" : "border-gray-300"
                            }`}
                          >
                            {active && (
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <div>
                            <span
                              className={`font-semibold text-sm ${
                                active ? "text-blue-700" : "text-gray-700"
                              }`}
                            >
                              {label}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">{desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Form Content */}
            {editingTemplate && !editingProductId ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {/* Product selector with product-type toggle */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label
                            htmlFor="finished_good_product"
                            className="text-sm font-semibold text-gray-700"
                          >
                            {templateProductType === "semi_finished"
                              ? "Semi Finished Good Products"
                              : "Finished Good Products"}{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          {/* Toggle: Finished Good / Semi-finished */}
                          <div className="flex rounded-md overflow-hidden border border-gray-300 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setTemplateProductType("finished_good");
                                setSelectedProduct(null);
                                handleInputChange("finished_good_product_id", "");
                                handleInputChange("type", "");
                              }}
                              className={`px-2.5 py-1 font-medium transition-colors ${
                                templateProductType === "finished_good"
                                  ? "bg-blue-600 text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              Finished Good
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTemplateProductType("semi_finished");
                                setSelectedProduct(null);
                                handleInputChange("finished_good_product_id", "");
                                handleInputChange("type", "raw_material");
                              }}
                              className={`px-2.5 py-1 font-medium border-l border-gray-300 transition-colors ${
                                templateProductType === "semi_finished"
                                  ? "bg-[#4267B2] text-white"
                                  : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              Semi-finished
                            </button>
                          </div>
                        </div>
                        {(templateProductType === "semi_finished" ? semiFinishedProducts : finishedGoodProducts).length === 0 ? (
                          <div className="text-sm text-gray-500 p-2 border border-gray-300 rounded">
                            No {templateProductType === "semi_finished" ? "semi-finished" : "finished good"} products found.
                          </div>
                        ) : (
                          <TypeaheadCustom
                            options={templateProductType === "semi_finished" ? semiFinishedProducts : finishedGoodProducts}
                            placeholder={`Search ${templateProductType === "semi_finished" ? "semi-finished" : "finished good"} products...`}
                            labelKey={(product) =>
                              `${product.name} (${product.sku || product.id})`
                            }
                            onChange={(selectedItems) => {
                              const selected = selectedItems.length > 0 ? selectedItems[0] : null;
                              setSelectedProduct(selected);
                              handleInputChange("finished_good_product_id", selected ? selected.id : "");
                            }}
                            selected={selectedProduct ? [selectedProduct] : []}
                            filterBy={(option, props) => {
                              const searchText = props.text.toLowerCase();
                              const name = (option.name || "").toLowerCase();
                              const sku = (option.sku || option.id || "").toLowerCase();
                              return name.includes(searchText) || sku.includes(searchText);
                            }}
                          />
                        )}
                      </div>

                      {/* Type — locked to Raw Material for semi-finished, full dropdown for finished good */}
                      <div>
                        <Label
                          htmlFor="type"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Type <span className="text-red-500">*</span>
                        </Label>
                        {templateProductType === "semi_finished" ? (
                          <Select
                            value={form.type || "raw_material"}
                            onValueChange={(value) => handleInputChange("type", value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">Raw Material</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={form.type}
                            onValueChange={(value) => handleInputChange("type", value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">Raw Material</SelectItem>
                              <SelectItem value="semi_finished">Semi Finished</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Ingredient Selection - Raw Material or Semi Finished */}
                    {(form.type === "raw_material" ||
                      form.type === "semi_finished") && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="raw_material"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          {form.type === "semi_finished"
                            ? "Semi Finished"
                            : "Raw Material"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        {form.type === "semi_finished" ? (
                          <TypeaheadCustom
                            options={semiFinishedProducts}
                            placeholder="Search semi-finished items by name or SKU..."
                            labelKey={(p) => `${p.name} (${p.sku || p.id})`}
                            onChange={(selectedItems) => {
                              const selected =
                                selectedItems.length > 0 ? selectedItems[0] : null;
                              setSelectedSemiFinishedItem(selected);
                              if (selected) {
                                handleInputChange("raw_material_id", selected.id);
                                handleInputChange("raw_material_name", selected.name);
                                handleInputChange(
                                  "raw_material_sku",
                                  selected.sku || selected.id
                                );
                              } else {
                                handleInputChange("raw_material_id", "");
                                handleInputChange("raw_material_name", "");
                                handleInputChange("raw_material_sku", "");
                              }
                            }}
                            selected={
                              selectedSemiFinishedItem ? [selectedSemiFinishedItem] : []
                            }
                          />
                        ) : (
                          <TypeaheadCustom
                            options={rawMaterials}
                            placeholder="Search raw materials by name or SKU..."
                            labelKey={(material) =>
                              `${material.name} (${material.sku})`
                            }
                            onChange={(selectedItems) => {
                              const selected =
                                selectedItems.length > 0 ? selectedItems[0] : null;
                              setSelectedRawMaterial(selected);
                              if (selected) {
                                handleInputChange("raw_material_id", selected.id);
                                handleInputChange("raw_material_name", selected.name);
                                handleInputChange("raw_material_sku", selected.sku);
                              } else {
                                handleInputChange("raw_material_id", "");
                                handleInputChange("raw_material_name", "");
                                handleInputChange("raw_material_sku", "");
                              }
                            }}
                            selected={
                              selectedRawMaterial ? [selectedRawMaterial] : []
                            }
                          />
                        )}
                      </div>
                    )}

                    {/* Unit Cost (Default Cost) - show for raw material and semi finished */}
                    {(form.type === "raw_material" ||
                      form.type === "semi_finished") && (
                      <div>
                        <Label
                          htmlFor="rate"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Unit Cost (₦)
                        </Label>
                        <Input
                          id="rate"
                          type="text"
                          value={formatNumberWithCommas(form.rate)}
                          onChange={(e) => {
                            const withoutCommas = e.target.value.replace(
                              /,/g,
                              ""
                            );
                            const sanitizedValue =
                              handleNumericInput(withoutCommas);
                            const parts = sanitizedValue.split(".");
                            const numericValue =
                              parts.length > 2
                                ? parts[0] + "." + parts.slice(1).join("")
                                : sanitizedValue;
                            handleInputChange("rate", numericValue);
                          }}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <small className="text-muted">
                          {valuationCostHint ||
                            "Select an item to load unit cost from business valuation settings. Editable."}
                        </small>
                      </div>
                    )}

                    {/* Account Head - Only show if type is "other" */}
                    {form.type === "other" && (
                      <div>
                        <Label
                          htmlFor="account_head"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Account Head <span className="text-red-500">*</span>
                        </Label>
                        <Typeahead
                          ref={expenseTypeaheadRef}
                          id="expense-item-typeahead-edit"
                          labelKey={(option) =>
                            `${option.name} (${option.code})`
                          }
                          options={expenseList}
                          placeholder="Select account head..."
                          onChange={(selectedItems) => {
                            if (selectedItems.length) {
                              const expense = selectedItems[0];
                              setSelectedExpense(expense);
                              handleInputChange(
                                "account_head",
                                expense.name || ""
                              );
                              handleInputChange(
                                "description_code",
                                expense.code || ""
                              );
                              // Auto-populate description with account name/description
                              handleInputChange(
                                "description",
                                expense.name || ""
                              );
                            } else {
                              // Clear selection when user deselects
                              setSelectedExpense(null);
                              handleInputChange("account_head", "");
                              handleInputChange("description_code", "");
                              handleInputChange("description", "");
                            }
                          }}
                          selected={
                            form.account_head && selectedExpense
                              ? expenseList.filter(
                                  (expense) =>
                                    expense.code === selectedExpense.code &&
                                    expense.name === selectedExpense.name
                                )
                              : []
                          }
                          allowNew={false}
                          renderMenuItemChildren={(option) => (
                            <div className="py-1">
                              <div className="font-semibold text-slate-800">
                                {option.code} {option.name}
                              </div>
                              <small className="text-slate-600 text-xs">
                                Type: {option.account_type}
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
                    )}

                    {/* Description - Only show if type is "other" or "by_product_credit" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") && (
                      <div>
                        <Label
                          htmlFor="description"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Description <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="description"
                          type="text"
                          value={form.description}
                          onChange={(e) =>
                            handleInputChange("description", e.target.value)
                          }
                          placeholder="Enter description..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    )}

                    {/* Input Type Selection - Only show if type is "other" or "by_product_credit" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") && (
                      <div>
                        <Label
                          htmlFor="other_type"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Input Type <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={form.other_type}
                          onValueChange={(value) =>
                            handleInputChange("other_type", value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select input type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rate">Rate</SelectItem>
                            <SelectItem value="percentage">
                              Percentage
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Percentage Basis Selection - Only show if type is "other" or "by_product_credit" and other_type is "percentage" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") &&
                      form.other_type === "percentage" && (
                        <div>
                          <Label
                            htmlFor="percentage_basis"
                            className="text-sm font-semibold text-gray-700 mb-1 block"
                          >
                            Percentage Basis{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={form.percentage_basis}
                            onValueChange={(value) =>
                              handleInputChange("percentage_basis", value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select percentage basis" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">
                                Raw Material Only
                              </SelectItem>
                              <SelectItem value="all_items">
                                All Items Above
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                    {/* Rate Input - Only show if type is "other" or "by_product_credit" and other_type is "rate" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") &&
                      form.other_type === "rate" && (
                        <div>
                          <Label
                            htmlFor="rate"
                            className="text-sm font-semibold text-gray-700 mb-1 block"
                          >
                            Rate (₦) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="rate"
                            type="text"
                            value={formatNumberWithCommas(form.rate)}
                            onChange={(e) => {
                              const withoutCommas = e.target.value.replace(
                                /,/g,
                                ""
                              );
                              const sanitizedValue =
                                handleNumericInput(withoutCommas);
                              const parts = sanitizedValue.split(".");
                              const numericValue =
                                parts.length > 2
                                  ? parts[0] + "." + parts.slice(1).join("")
                                  : sanitizedValue;
                              handleInputChange("rate", numericValue);
                            }}
                            placeholder="0.00"
                            className=" w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent "
                            required
                          />
                        </div>
                      )}

                    {/* Quantity/Percentage Input - Hide if type is "other" or "by_product_credit" and other_type is "rate" */}
                    {!(
                      (form.type === "other" ||
                        form.type === "by_product_credit") &&
                      form.other_type === "rate"
                    ) && (
                      <div>
                        <Label
                          htmlFor="quantity"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          {(form.type === "other" ||
                            form.type === "by_product_credit") &&
                          form.other_type === "percentage"
                            ? "Percentage (%)"
                            : "Quantity"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.0001"
                          min="0"
                          max={
                            (form.type === "other" ||
                              form.type === "by_product_credit") &&
                            form.other_type === "percentage"
                              ? 100
                              : undefined
                          }
                          value={form.quantity === "" || form.quantity == null ? "" : form.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              handleInputChange("quantity", "");
                              return;
                            }
                            const numVal = parseFloat(val);
                            if (isNaN(numVal)) return;
                            // Validate percentage max value
                            if (
                              (form.type === "other" ||
                                form.type === "by_product_credit") &&
                              form.other_type === "percentage"
                            ) {
                              if (numVal > 100) return;
                            }
                            handleInputChange("quantity", val);
                          }}
                          placeholder="0.0000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                    disabled={loading}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !form.finished_good_product_id ||
                      !form.type ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        !form.account_head?.trim()) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        !form.description?.trim()) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        !form.other_type) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        form.other_type === "rate" &&
                        !form.rate) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        form.other_type === "percentage" &&
                        !form.quantity) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        form.other_type === "percentage" &&
                        !form.percentage_basis) ||
                      (form.type !== "other" &&
                        form.type !== "by_product_credit" &&
                        !form.quantity) ||
                      (form.type === "raw_material" && !form.raw_material_id)
                    }
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingTemplate
                          ? "Update Template"
                          : "Create Template"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : costingMode === "single" || costingMode === "semi_finished" ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {/* Finished Good Product and Type on same line */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label
                          htmlFor="finished_good_product"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          {costingMode === "semi_finished"
                            ? "Semi Finished Good Products"
                            : "Finished Good Products"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        {(() => {
                          const productOptions =
                            costingMode === "semi_finished"
                              ? semiFinishedProducts
                              : finishedGoodProducts;
                          const productNoun =
                            costingMode === "semi_finished"
                              ? "semi-finished"
                              : "finished good";
                          if (productOptions.length === 0) {
                            return (
                              <div className="text-sm text-gray-500 p-2 border border-gray-300 rounded">
                                No {productNoun} products found. Please create{" "}
                                {productNoun} products first.
                              </div>
                            );
                          }
                          if (editingProductId) {
                            return (
                              <div className="text-sm p-2 border border-gray-300 rounded bg-gray-100">
                                {editingTemplate?.productName ||
                                  selectedProduct?.name ||
                                  "—"}
                              </div>
                            );
                          }
                          return (
                            <TypeaheadCustom
                              options={productOptions}
                              placeholder={`Search ${productNoun} products by name or SKU...`}
                              labelKey={(product) =>
                                `${product.name} (${product.sku || product.id})`
                              }
                              onChange={(selectedItems) => {
                                const selected =
                                  selectedItems.length > 0
                                    ? selectedItems[0]
                                    : null;
                                setSelectedProduct(selected);
                                if (selected) {
                                  handleInputChange(
                                    "finished_good_product_id",
                                    selected.id
                                  );
                                } else {
                                  handleInputChange(
                                    "finished_good_product_id",
                                    ""
                                  );
                                }
                              }}
                              selected={selectedProduct ? [selectedProduct] : []}
                              filterBy={(option, props) => {
                                const searchText = props.text.toLowerCase();
                                const name = (option.name || "").toLowerCase();
                                const sku = (
                                  option.sku ||
                                  option.id ||
                                  ""
                                ).toLowerCase();
                                return (
                                  name.includes(searchText) ||
                                  sku.includes(searchText)
                                );
                              }}
                            />
                          );
                        })()}
                      </div>

                      {/* Type Selection */}
                      <div>
                        <Label
                          htmlFor="type"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Type <span className="text-red-500">*</span>
                        </Label>
                        {costingMode === "semi_finished" ? (
                          <Select
                            value={form.type || "raw_material"}
                            onValueChange={(value) =>
                              handleInputChange("type", value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">
                                Raw Material
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={form.type}
                            onValueChange={(value) =>
                              handleInputChange("type", value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">
                                Raw Material
                              </SelectItem>
                              <SelectItem value="semi_finished">
                                Semi Finished
                              </SelectItem>
                              <SelectItem value="by_product_credit">
                                By-product credit
                              </SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {costingMode === "semi_finished" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <FormGroup>
                          <Label className="text-sm font-semibold text-gray-700">
                            Template name{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="text"
                            value={semiCostingTemplateName}
                            onChange={(e) =>
                              setSemiCostingTemplateName(e.target.value)
                            }
                            disabled={!!editingSemiTemplateId}
                            placeholder="e.g. Standard mix, High-yield"
                            className="mt-1"
                          />
                          {editingSemiTemplateId ? (
                            <small className="text-muted d-block mt-1">
                              To use a different name, create a new template; names are unique per product.
                            </small>
                          ) : null}
                        </FormGroup>
                        <FormGroup className="d-flex align-items-end pb-1">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="semi_costing_is_default"
                              checked={semiCostingIsDefault}
                              onChange={(e) =>
                                setSemiCostingIsDefault(e.target.checked)
                              }
                            />
                            <label
                              className="form-check-label text-sm ms-2"
                              htmlFor="semi_costing_is_default"
                            >
                              Default recipe for this product (used first in
                              Mixture when several templates exist)
                            </label>
                          </div>
                        </FormGroup>
                      </div>
                    )}

                    {/* Ingredient Selection - show for raw material, semi finished, or semi-finished costing mode */}
                    {(form.type === "raw_material" ||
                      form.type === "semi_finished" ||
                      costingMode === "semi_finished") && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="raw_material"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          {form.type === "semi_finished"
                            ? "Semi Finished"
                            : "Raw Material"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        {form.type === "semi_finished" ? (
                          <TypeaheadCustom
                            options={semiFinishedProducts}
                            placeholder="Search semi-finished items by name or SKU..."
                            labelKey={(p) => `${p.name} (${p.sku || p.id})`}
                            onChange={(selectedItems) => {
                              const selected =
                                selectedItems.length > 0 ? selectedItems[0] : null;
                              setSelectedSemiFinishedItem(selected);
                              if (selected) {
                                handleInputChange("raw_material_id", selected.id);
                                handleInputChange("raw_material_name", selected.name);
                                handleInputChange(
                                  "raw_material_sku",
                                  selected.sku || selected.id
                                );
                              } else {
                                handleInputChange("raw_material_id", "");
                                handleInputChange("raw_material_name", "");
                                handleInputChange("raw_material_sku", "");
                              }
                            }}
                            selected={
                              selectedSemiFinishedItem ? [selectedSemiFinishedItem] : []
                            }
                          />
                        ) : (
                          <TypeaheadCustom
                            options={rawMaterials}
                            placeholder="Search raw materials by name or SKU..."
                            labelKey={(material) =>
                              `${material.name} (${material.sku})`
                            }
                            onChange={(selectedItems) => {
                              const selected =
                                selectedItems.length > 0 ? selectedItems[0] : null;
                              setSelectedRawMaterial(selected);
                              if (selected) {
                                handleInputChange("raw_material_id", selected.id);
                                handleInputChange("raw_material_name", selected.name);
                                handleInputChange("raw_material_sku", selected.sku);
                              } else {
                                handleInputChange("raw_material_id", "");
                                handleInputChange("raw_material_name", "");
                                handleInputChange("raw_material_sku", "");
                              }
                            }}
                            selected={
                              selectedRawMaterial ? [selectedRawMaterial] : []
                            }
                          />
                        )}
                      </div>
                    )}

                    {/* Unit Cost (Default Cost) - show for raw material and semi finished */}
                    {(form.type === "raw_material" ||
                      form.type === "semi_finished" ||
                      costingMode === "semi_finished") && (
                      <div>
                        <Label
                          htmlFor="rate-create"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Unit Cost (₦)
                        </Label>
                        <Input
                          id="rate-create"
                          type="text"
                          value={formatNumberWithCommas(form.rate)}
                          onChange={(e) => {
                            const withoutCommas = e.target.value.replace(
                              /,/g,
                              ""
                            );
                            const sanitizedValue =
                              handleNumericInput(withoutCommas);
                            const parts = sanitizedValue.split(".");
                            const numericValue =
                              parts.length > 2
                                ? parts[0] + "." + parts.slice(1).join("")
                                : sanitizedValue;
                            handleInputChange("rate", numericValue);
                          }}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <small className="text-muted">
                          {valuationCostHint ||
                            "Select an item to load unit cost from business valuation settings. Editable."}
                        </small>
                      </div>
                    )}

                    {/* Account Head - Only show if type is "other" or "by_product_credit" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") && (
                      <div>
                        <Label
                          htmlFor="account_head"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Account Head <span className="text-red-500">*</span>
                        </Label>
                        <Typeahead
                          ref={expenseTypeaheadRef}
                          id="expense-item-typeahead-create"
                          labelKey={(option) =>
                            `${option.name} (${option.code})`
                          }
                          options={expenseList}
                          placeholder="Select account head..."
                          onChange={(selectedItems) => {
                            if (selectedItems.length) {
                              const expense = selectedItems[0];
                              setSelectedExpense(expense);
                              handleInputChange(
                                "account_head",
                                expense.name || ""
                              );
                              handleInputChange(
                                "description_code",
                                expense.code || ""
                              );
                              // Auto-populate description with account name/description
                              handleInputChange(
                                "description",
                                expense.name || ""
                              );
                            } else {
                              // Clear selection when user deselects
                              setSelectedExpense(null);
                              handleInputChange("account_head", "");
                              handleInputChange("description_code", "");
                              handleInputChange("description", "");
                            }
                          }}
                          selected={
                            form.account_head && selectedExpense
                              ? expenseList.filter(
                                  (expense) =>
                                    expense.code === selectedExpense.code &&
                                    expense.name === selectedExpense.name
                                )
                              : []
                          }
                          allowNew={false}
                          renderMenuItemChildren={(option) => (
                            <div className="py-1">
                              <div className="font-semibold text-slate-800">
                                {option.code} {option.name}
                              </div>
                              <small className="text-slate-600 text-xs">
                                Type: {option.account_type}
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
                    )}

                    {/* Description - Only show if type is "other" or "by_product_credit" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") && (
                      <div>
                        <Label
                          htmlFor="description"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Description <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="description"
                          type="text"
                          value={form.description}
                          onChange={(e) =>
                            handleInputChange("description", e.target.value)
                          }
                          placeholder="Enter description..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    )}

                    {/* Input Type Selection - Only show if type is "other" or "by_product_credit" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") && (
                      <div>
                        <Label
                          htmlFor="other_type"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          Input Type <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={form.other_type}
                          onValueChange={(value) =>
                            handleInputChange("other_type", value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select input type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="rate">Rate</SelectItem>
                            <SelectItem value="percentage">
                              Percentage
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Percentage Basis Selection - Only show if type is "other" or "by_product_credit" and other_type is "percentage" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") &&
                      form.other_type === "percentage" && (
                        <div>
                          <Label
                            htmlFor="percentage_basis"
                            className="text-sm font-semibold text-gray-700 mb-1 block"
                          >
                            Percentage Basis{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={form.percentage_basis}
                            onValueChange={(value) =>
                              handleInputChange("percentage_basis", value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select percentage basis" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="raw_material">
                                Raw Material Only
                              </SelectItem>
                              <SelectItem value="all_items">
                                All Items Above
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                    {/* Rate Input - Only show if type is "other" or "by_product_credit" and other_type is "rate" */}
                    {(form.type === "other" ||
                      form.type === "by_product_credit") &&
                      form.other_type === "rate" && (
                        <div>
                          <Label
                            htmlFor="rate"
                            className="text-sm font-semibold text-gray-700 mb-1 block"
                          >
                            Rate (₦) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="rate"
                            type="text"
                            value={formatNumberWithCommas(form.rate)}
                            onChange={(e) => {
                              const withoutCommas = e.target.value.replace(
                                /,/g,
                                ""
                              );
                              const sanitizedValue =
                                handleNumericInput(withoutCommas);
                              const parts = sanitizedValue.split(".");
                              const numericValue =
                                parts.length > 2
                                  ? parts[0] + "." + parts.slice(1).join("")
                                  : sanitizedValue;
                              handleInputChange("rate", numericValue);
                            }}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-"
                            required
                          />
                        </div>
                      )}

                    {/* Quantity/Percentage Input - Hide if type is "other" or "by_product_credit" and other_type is "rate" */}
                    {!(
                      (form.type === "other" ||
                        form.type === "by_product_credit") &&
                      form.other_type === "rate"
                    ) && (
                      <div>
                        <Label
                          htmlFor="quantity"
                          className="text-sm font-semibold text-gray-700 mb-1 block"
                        >
                          {(form.type === "other" ||
                            form.type === "by_product_credit") &&
                          form.other_type === "percentage"
                            ? "Percentage (%)"
                            : "Quantity"}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.0001"
                          min="0"
                          max={
                            (form.type === "other" ||
                              form.type === "by_product_credit") &&
                            form.other_type === "percentage"
                              ? 100
                              : undefined
                          }
                          value={form.quantity === "" || form.quantity == null ? "" : form.quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "") {
                              handleInputChange("quantity", "");
                              return;
                            }
                            const numVal = parseFloat(val);
                            if (isNaN(numVal)) return;
                            // Validate percentage max value
                            if (
                              (form.type === "other" ||
                                form.type === "by_product_credit") &&
                              form.other_type === "percentage"
                            ) {
                              if (numVal > 100) return;
                            }
                            handleInputChange("quantity", val);
                          }}
                          placeholder="0.0000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    )}
                    {/* {JSON.stringify(itemList)} */}
                    {/* Item List Display */}
                    {itemList.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Items to be added ({itemList.length}) — drag to reorder
                        </Label>
                        <div className="border rounded p-3 max-h-48 overflow-y-auto">
                          <DndContext
                            collisionDetection={closestCenter}
                            modifiers={[restrictToVerticalAxis]}
                            onDragEnd={handleItemListDragEnd}
                            sensors={itemListSensors}
                          >
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr>
                                  <th className="w-8"></th>
                                <th>Description</th>
                                <th className="text-center">
                                  Qty/Rate/Percentage
                                </th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                                <SortableContext
                                  items={itemList.map((i) => i.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                              {itemList.map((item) => (
                                    <SortableItemRow key={item.id} item={item}>
                                  <td>
                                    <div>{item.description}</div>
                                    <span className="badge bg-info text-capitalize mt-1">
                                      {item.type === "raw_material"
                                        ? "Raw Material"
                                        : item.type === "semi_finished"
                                        ? "Semi Finished"
                                        : item.type === "by_product_credit"
                                        ? "By-product credit"
                                        : "Other"}
                                    </span>
                                  </td>
                                  <td className="text-center">
                                    {editingItemId === item.id &&
                                    (item.type === "raw_material" ||
                                      item.type === "semi_finished") ? (
                                      <div className="d-flex flex-column gap-3 align-items-center">
                                        <div className="d-flex flex-column gap-1 align-items-center">
                                          <small className="text-muted">Qty</small>
                                          <Input
                                            type="number"
                                            step="0.0001"
                                            min="0"
                                            value={item.quantity ?? ""}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              handleUpdateItemInList(
                                                item.id,
                                                { quantity: val === "" ? 0 : parseFloat(val) || 0 },
                                                false
                                              );
                                            }}
                                            className="form-control form-control-sm text-center"
                                            style={{ width: "80px" }}
                                          />
                                        </div>
                                        <div className="d-flex flex-column gap-1 align-items-center">
                                          <small className="text-muted">Cost (₦)</small>
                                          <Input
                                            type="text"
                                            value={formatNumberWithCommas(item.rate || "")}
                                            onChange={(e) => {
                                              const val = e.target.value.replace(
                                                /[,]/g,
                                                ""
                                              );
                                              handleUpdateItemInList(
                                                item.id,
                                                { rate: val },
                                                false
                                              );
                                            }}
                                            className="form-control form-control-sm text-center"
                                            style={{ width: "100px" }}
                                            placeholder="Cost"
                                          />
                                        </div>
                                      </div>
                                    ) : editingItemId === item.id &&
                                      (item.type === "other" ||
                                        item.type === "by_product_credit") ? (
                                      <div className="d-flex flex-column gap-3 align-items-center">
                                        {item.other_type === "rate" ? (
                                          <div className="d-flex flex-column gap-1 align-items-center">
                                            <small className="text-muted">Rate (₦)</small>
                                            <Input
                                              type="text"
                                              value={formatNumberWithCommas(item.rate || "")}
                                              onChange={(e) => {
                                                const val = e.target.value.replace(
                                                  /[,]/g,
                                                  ""
                                                );
                                                handleUpdateItemInList(
                                                  item.id,
                                                  { rate: val },
                                                  false
                                                );
                                              }}
                                              className="form-control form-control-sm text-center"
                                              style={{ width: "100px" }}
                                              placeholder="Rate"
                                            />
                                          </div>
                                        ) : item.other_type === "percentage" ? (
                                          <div className="d-flex flex-column gap-1 align-items-center">
                                            <small className="text-muted">Percentage (%)</small>
                                            <Input
                                              type="number"
                                              step="0.0001"
                                              min="0"
                                              max="100"
                                              value={item.quantity ?? ""}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                handleUpdateItemInList(
                                                  item.id,
                                                  { quantity: val === "" ? 0 : parseFloat(val) || 0 },
                                                  false
                                                );
                                              }}
                                              className="form-control form-control-sm text-center"
                                              style={{ width: "80px" }}
                                              placeholder="%"
                                            />
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : item.type === "raw_material" ||
                                      item.type === "semi_finished" ? (
                                      <div>
                                      <span className="fw-semibold">
                                        {formatQuantity(item.quantity || 0)}
                                      </span>
                                        {item.rate != null &&
                                          item.rate !== "" && (
                                            <>
                                              <br />
                                              <small className="text-muted">
                                                ₦{formatNumber1(item.rate || 0)}
                                              </small>
                                            </>
                                          )}
                                      </div>
                                    ) : (item.type === "other" ||
                                        item.type === "by_product_credit") &&
                                      item.other_type === "rate" ? (
                                      <div>
                                        <span className="fw-semibold">
                                          ₦{formatNumber1(item.rate || 0)}
                                        </span>
                                        <br />
                                        <small className="text-muted">
                                          Rate
                                        </small>
                                      </div>
                                    ) : (item.type === "other" ||
                                        item.type === "by_product_credit") &&
                                      item.other_type === "percentage" ? (
                                      <div>
                                        <span className="fw-semibold">
                                          {formatQuantity(item.quantity || 0)}%
                                        </span>
                                        <br />
                                        <small className="text-muted">
                                          Percentage
                                        </small>
                                      </div>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td>
                                    <div className="d-flex gap-1 justify-content-center">
                                      {(item.type === "raw_material" ||
                                        item.type === "semi_finished" ||
                                        (item.type === "other" ||
                                          item.type === "by_product_credit") &&
                                          (item.other_type === "rate" ||
                                            item.other_type === "percentage")) && (
                                        <Button
                                          size="sm"
                                          color={
                                            editingItemId === item.id
                                              ? "outline-success"
                                              : "outline-primary"
                                          }
                                          onClick={() =>
                                            setEditingItemId(
                                              editingItemId === item.id
                                                ? null
                                                : item.id
                                            )
                                          }
                                          title={
                                            editingItemId === item.id
                                              ? "Save and close"
                                              : item.type === "raw_material" ||
                                                item.type === "semi_finished"
                                              ? "Edit cost"
                                              : "Edit rate or percentage"
                                          }
                                        >
                                          {editingItemId === item.id ? (
                                            <Save size={12} />
                                          ) : (
                                            <Edit size={12} />
                                          )}
                                        </Button>
                                      )}
                                    <Button
                                      size="sm"
                                      color="outline-danger"
                                      onClick={() =>
                                        handleRemoveFromList(item.id)
                                      }
                                    >
                                      <Trash2 size={12} />
                                    </Button>
                                    </div>
                                  </td>
                                    </SortableItemRow>
                              ))}
                                </SortableContext>
                            </tbody>
                          </table>
                          </DndContext>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium"
                    disabled={loading}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleAddToList}
                    disabled={
                      loading ||
                      !form.finished_good_product_id ||
                      !form.type ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        !form.account_head?.trim()) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        !form.description?.trim()) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        !form.other_type) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        form.other_type === "rate" &&
                        (() => {
                          const rateValue = form.rate
                            ? String(form.rate).replace(/,/g, "")
                            : "";
                          const rateNum = parseFloat(rateValue);
                          return !rateValue || isNaN(rateNum) || rateNum <= 0;
                        })()) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        form.other_type === "percentage" &&
                        (!form.quantity ||
                          parseFloat(form.quantity) <= 0 ||
                          parseFloat(form.quantity) > 100)) ||
                      ((form.type === "other" ||
                        form.type === "by_product_credit") &&
                        form.other_type === "percentage" &&
                        !form.percentage_basis) ||
                      (form.type !== "other" &&
                        form.type !== "by_product_credit" &&
                        form.type !== "raw_material" &&
                        !form.quantity) ||
                      (form.type === "raw_material" && !form.raw_material_id)
                    }
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Add to List
                  </button>
                  <button
                    type="button"
                    onClick={
                      editingProductId
                        ? handleUpdateProductItems
                        : handleSubmitList
                    }
                    disabled={loading || itemList.length === 0}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        {editingProductId
                          ? "Update"
                          : `Submit All (${itemList.length})`}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Shared Costing Form */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="p-4 flex-1 overflow-y-auto">
                  {/* Product Group Selection */}
                  <div className="mb-4">
                    <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                      Select Product Group{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2 items-center">
                      <Select
                        value={sharedCostingName}
                        onValueChange={(value) => {
                          const selectedGroup = productGroups.find(
                            (g) => g.name === value
                          );
                          handleProductGroupSelection(selectedGroup);
                        }}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a product group..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productGroups.map((group) => (
                            <SelectItem key={group.id} value={group.name}>
                              {group.name} ({group.products?.length || 0}{" "}
                              products)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sharedProducts.length > 0 && (
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          SKUs:{" "}
                          {sharedProducts
                            .map((sp) => sp.product.sku || sp.product.id)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shared Costs Section */}
                  <div className="mb-4 border rounded p-3 bg-gray-50">
                    <h4 className="font-semibold text-gray-700 mb-3">
                      Shared Costs
                    </h4>

                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                          Type <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={form.type}
                          onValueChange={(v) => handleInputChange("type", v)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="raw_material">
                              Raw Material
                            </SelectItem>
                            <SelectItem value="semi_finished">
                              Semi Finished
                            </SelectItem>
                            <SelectItem value="by_product_credit">
                              By-product Credit
                            </SelectItem>
                            {/* <SelectItem value="waste">Waste</SelectItem> */}
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Ingredient Selection */}
                    {(form.type === "raw_material" ||
                      form.type === "semi_finished") && (
                      <div className="space-y-3 mb-3">
                        <div>
                          <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                            {form.type === "semi_finished"
                              ? "Semi Finished"
                              : "Raw Material"}{" "}
                            <span className="text-red-500">*</span>
                          </Label>
                          {form.type === "semi_finished" ? (
                            <TypeaheadCustom
                              options={semiFinishedProducts}
                              placeholder="Search semi-finished items..."
                              labelKey={(p) => `${p.name} (${p.sku || p.id})`}
                              onChange={(sel) => {
                                const s = sel[0];
                                setSelectedSemiFinishedItem(s || null);
                                if (s) {
                                  handleInputChange("raw_material_id", s.id);
                                  handleInputChange("raw_material_name", s.name);
                                  handleInputChange(
                                    "raw_material_sku",
                                    s.sku || s.id
                                  );
                                  if (s.cost_price != null && !form.rate) {
                                    handleInputChange("rate", String(s.cost_price));
                                  }
                                }
                              }}
                              selected={
                                selectedSemiFinishedItem
                                  ? [selectedSemiFinishedItem]
                                  : []
                              }
                            />
                          ) : (
                            <TypeaheadCustom
                              options={rawMaterials}
                              placeholder="Search raw materials..."
                              labelKey={(m) => `${m.name} (${m.sku})`}
                              onChange={(sel) => {
                                const s = sel[0];
                                setSelectedRawMaterial(s || null);
                                if (s) {
                                  handleInputChange("raw_material_id", s.id);
                                  handleInputChange("raw_material_name", s.name);
                                  handleInputChange("raw_material_sku", s.sku);
                                  if (s.cost_price != null && !form.rate) {
                                    handleInputChange("rate", String(s.cost_price));
                                  }
                                }
                              }}
                              selected={
                                selectedRawMaterial ? [selectedRawMaterial] : []
                              }
                            />
                          )}
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                            Quantity <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            value={form.quantity}
                            onChange={(e) =>
                              handleInputChange("quantity", e.target.value)
                            }
                            placeholder="0.0000"
                            min={0}
                            step="0.0001"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                            Cost (₦)
                          </Label>
                          <Input
                            type="text"
                            value={formatNumberWithCommas(form.rate)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/,/g, "");
                              handleInputChange("rate", val);
                            }}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}

                    {/* By-product/Waste/Other - Account Head, Description, Input Type */}
                    {(form.type === "waste" ||
                      form.type === "other" ||
                      form.type === "by_product_credit") && (
                      <div className="space-y-3 mb-3">
                        <div>
                          <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                            Account Head <span className="text-red-500">*</span>
                          </Label>
                          <Typeahead
                            id="shared-expense-typeahead"
                            labelKey={(option) =>
                              `${option.name} (${option.code})`
                            }
                            options={expenseList}
                            placeholder="Select account head..."
                            onChange={(selectedItems) => {
                              if (selectedItems.length) {
                                const expense = selectedItems[0];
                                setSelectedExpense(expense);
                                handleInputChange(
                                  "account_head",
                                  expense.name || ""
                                );
                                handleInputChange(
                                  "description_code",
                                  expense.code || ""
                                );
                                handleInputChange(
                                  "description",
                                  expense.name || ""
                                );
                              } else {
                                setSelectedExpense(null);
                                handleInputChange("account_head", "");
                                handleInputChange("description_code", "");
                                handleInputChange("description", "");
                              }
                            }}
                            selected={selectedExpense ? [selectedExpense] : []}
                            renderMenuItemChildren={(option) => (
                              <div className="py-1">
                                <div className="font-semibold text-slate-800">
                                  {option.code} {option.name}
                                </div>
                                <small className="text-slate-600 text-xs">
                                  Type: {option.account_type}
                                </small>
                              </div>
                            )}
                            inputProps={{
                              style: {
                                width: "100%",
                                padding: "0.5rem 0.75rem",
                                fontSize: "0.875rem",
                                border: "1px solid rgb(209 213 219)",
                                borderRadius: "0.375rem",
                              },
                            }}
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                            Description <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="text"
                            value={form.description}
                            onChange={(e) =>
                              handleInputChange("description", e.target.value)
                            }
                            placeholder="Enter description..."
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                            Input Type <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={form.other_type}
                            onValueChange={(v) =>
                              handleInputChange("other_type", v)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select input type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rate">Rate</SelectItem>
                              <SelectItem value="percentage">
                                Percentage
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {form.other_type === "rate" && (
                          <div>
                            <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                              Rate (₦) <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              type="text"
                              value={formatNumberWithCommas(form.rate)}
                              onChange={(e) => {
                                const val = e.target.value.replace(/,/g, "");
                                handleInputChange("rate", val);
                              }}
                              placeholder="0.00"
                              className="w-full"
                            />
                          </div>
                        )}

                        {form.other_type === "percentage" && (
                          <>
                            <div>
                              <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                                Percentage (%){" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                type="text"
                                value={form.quantity}
                                onChange={(e) =>
                                  handleInputChange("quantity", e.target.value)
                                }
                                placeholder="0.00"
                                className="w-full"
                              />
                            </div>
                            <div>
                              <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                                Percentage Basis{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <Select
                                value={form.percentage_basis}
                                onValueChange={(v) =>
                                  handleInputChange("percentage_basis", v)
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select percentage basis" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="raw_material">
                                    Raw Material Only
                                  </SelectItem>
                                  <SelectItem value="all_items">
                                    All Items Above
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <Button
                      size="sm"
                      color="secondary"
                      onClick={handleAddSharedCost}
                      disabled={!form.type}
                    >
                      <Plus size={14} className="mr-1" /> Add Shared Cost
                    </Button>

                    {/* Shared Costs List */}
                    {sharedCosts.length > 0 && (
                      <div className="mt-3 border rounded bg-white">
                        <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                          Shared costs — drag to reorder
                        </Label>
                        <DndContext
                          collisionDetection={closestCenter}
                          modifiers={[restrictToVerticalAxis]}
                          onDragEnd={handleSharedCostDragEnd}
                          sensors={itemListSensors}
                        >
                        <table className="table table-sm mb-0">
                          <thead className="table-light">
                            <tr>
                                <th className="w-8"></th>
                              <th>Description</th>
                                <th className="text-center">Qty/Rate/Percentage</th>
                                <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                              <SortableContext
                                items={sharedCosts.map((i) => i.id)}
                                strategy={verticalListSortingStrategy}
                              >
                            {sharedCosts.map((item) => (
                                  <SortableSharedCostRow key={item.id} item={item}>
                                    <td>
                                      <div>{item.description}</div>
                                      {item.account_head && (
                                        <small className="text-muted d-block">
                                          Account: {item.account_head}
                                        </small>
                                      )}
                                  <span
                                        className={`badge mt-1 ${
                                      item.type === "raw_material"
                                        ? "bg-info"
                                        : item.type === "semi_finished"
                                        ? "bg-primary"
                                        : item.type === "by_product_credit"
                                        ? "bg-success"
                                        : item.type === "waste"
                                        ? "bg-warning"
                                        : "bg-secondary"
                                    }`}
                                  >
                                    {item.type === "raw_material"
                                      ? "Raw Material"
                                      : item.type === "semi_finished"
                                      ? "Semi Finished"
                                      : item.type === "by_product_credit"
                                      ? "By-product"
                                      : item.type === "waste"
                                      ? "Waste"
                                      : "Other"}
                                  </span>
                                </td>
                                    <td className="text-center">
                                      {editingSharedCostId === item.id ? (
                                        <div className="d-flex flex-column gap-2 align-items-center">
                                          {item.type === "raw_material" ? (
                                            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-center">
                                              <div className="d-flex flex-column gap-1 align-items-center">
                                                <small className="text-muted">Qty</small>
                                                <Input
                                                  type="number"
                                                  step="0.0001"
                                                  min={0}
                                                  value={item.quantity ?? ""}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    handleUpdateSharedCostInList(item.id, {
                                                      quantity: val === "" ? 0 : parseFloat(val) || 0,
                                                    });
                                                  }}
                                                  className="form-control form-control-sm text-center"
                                                  style={{ width: "80px" }}
                                                />
                                              </div>
                                              <div className="d-flex flex-column gap-1 align-items-center">
                                                <small className="text-muted">Cost (₦)</small>
                                                <Input
                                                  type="number"
                                                  value={item.rate ?? ""}
                                                  onChange={(e) => {
                                                    handleUpdateSharedCostInList(item.id, {
                                                      rate: e.target.value,
                                                    });
                                                  }}
                                                  className="form-control form-control-sm text-center"
                                                  style={{ width: "100px" }}
                                                  placeholder="Rate"
                                                  min={0}
                                                  step="0.0001"
                                                />
                                              </div>
                                            </div>
                                          ) : item.other_type === "rate" ? (
                                            <div className="d-flex flex-column gap-1 align-items-center">
                                              <small className="text-muted">Rate (₦)</small>
                                              <Input
                                                type="number"
                                                value={item.rate ?? ""}
                                                onChange={(e) => {
                                                  handleUpdateSharedCostInList(item.id, {
                                                    rate: e.target.value,
                                                  });
                                                }}
                                                className="form-control form-control-sm text-center"
                                                style={{ width: "100px" }}
                                                placeholder="Rate"
                                                min={0}
                                                step="0.0001"
                                              />
                                            </div>
                                          ) : item.other_type === "percentage" ? (
                                            <div className="d-flex flex-column gap-1 align-items-center">
                                              <small className="text-muted">Percentage (%)</small>
                                              <Input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                max="100"
                                                value={item.quantity ?? ""}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  handleUpdateSharedCostInList(item.id, {
                                                    quantity: val === "" ? 0 : parseFloat(val) || 0,
                                                  });
                                                }}
                                                className="form-control form-control-sm text-center"
                                                style={{ width: "80px" }}
                                                placeholder="%"
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : item.type === "raw_material" ||
                                        item.type === "semi_finished" ? (
                                        <div className="d-flex flex-column gap-0 align-items-center">
                                          <span>{formatQuantity(item.quantity)}</span>
                                          {item.rate != null && item.rate !== "" && (
                                            <small className="text-muted">₦{formatNumber1(item.rate)}</small>
                                          )}
                                        </div>
                                      ) : item.other_type === "rate" ? (
                                        `₦${formatNumber1(item.rate)}`
                                      ) : item.other_type === "percentage" ? (
                                        `${formatQuantity(item.quantity)}%`
                                      ) : (
                                        <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                      <div className="d-flex gap-1 justify-content-center">
                                        {(item.type === "raw_material" ||
                                          item.type === "semi_finished" ||
                                          (item.type === "other" ||
                                            item.type === "by_product_credit" ||
                                            item.type === "waste") &&
                                            (item.other_type === "rate" ||
                                              item.other_type === "percentage")) && (
                                  <Button
                                    size="sm"
                                            color={
                                              editingSharedCostId === item.id
                                                ? "outline-success"
                                                : "outline-primary"
                                            }
                                    onClick={() =>
                                              setEditingSharedCostId(
                                                editingSharedCostId === item.id ? null : item.id
                                              )
                                            }
                                            title={
                                              editingSharedCostId === item.id
                                                ? "Save and close"
                                                : "Edit"
                                            }
                                          >
                                            {editingSharedCostId === item.id ? (
                                              <Save size={12} />
                                            ) : (
                                              <Edit size={12} />
                                            )}
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          color="outline-danger"
                                          onClick={() => handleRemoveSharedCost(item.id)}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                      </div>
                                </td>
                                  </SortableSharedCostRow>
                            ))}
                              </SortableContext>
                          </tbody>
                        </table>
                        </DndContext>
                      </div>
                    )}

                    {/* Output Input */}
                    <div className="mt-3">
                      <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                        Output Percentage
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={outputPercentage}
                        onChange={(e) => setOutputPercentage(e.target.value)}
                        placeholder="Enter output percentage..."
                        className="w-full"
                      />
                    </div>

                    {/* Template By-Product (inventory item_type By-Product) */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-700 mb-3">
                        Template By-Product
                      </h4>
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1">
                        <TypeaheadCustom
                          options={templateByProductList}
                          placeholder="Select by-product to add..."
                          labelKey={(bp) =>
                            `${bp.name} (${bp.sku || bp.item_code || bp.id})`
                          }
                          onChange={(sel) => {
                            const bp = sel[0] || null;
                            setSelectedTemplateByProduct(bp);
                            setTemplateByProductQty("1");
                            setTemplateByProductUnitCost(
                              bp?.cost_price != null && bp.cost_price !== ""
                                ? String(bp.cost_price)
                                : "",
                            );
                            setTemplateByProductItems([]);
                            setActiveSharedProductIndex(null);
                          }}
                          selected={
                            selectedTemplateByProduct
                              ? [selectedTemplateByProduct]
                              : []
                          }
                        />
                      </div>
                    </div>

                    {selectedTemplateByProduct && (
                      <div className="border rounded-lg bg-white shadow-sm">
                        <div className="flex justify-between items-center p-3 border-b bg-gray-50">
                          <div className="flex items-center gap-4 flex-1">
                            <div>
                              <span className="font-bold text-gray-900 text-base">
                                {selectedTemplateByProduct.name}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">
                                (
                                {selectedTemplateByProduct.sku ||
                                  selectedTemplateByProduct.item_code ||
                                  selectedTemplateByProduct.id}
                                )
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-semibold text-gray-700">
                                Units:
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={templateByProductQty || ""}
                                onChange={(e) =>
                                  setTemplateByProductQty(e.target.value)
                                }
                                className="h-8 w-32 px-2 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                placeholder="1"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-semibold text-gray-700">
                                Unit Cost:
                              </label>
                              <input
                                type="text"
                                value={formatNumberWithCommas(
                                  templateByProductUnitCost || "",
                                )}
                                onChange={(e) => {
                                  const val = e.target.value.replace(
                                    /[,]/g,
                                    "",
                                  );
                                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                    setTemplateByProductUnitCost(val);
                                  }
                                }}
                                className="h-8 w-32 px-2 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTemplateByProduct(null);
                              setTemplateByProductQty("1");
                              setTemplateByProductUnitCost("");
                              setTemplateByProductItems([]);
                              setActiveSharedProductIndex(null);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors"
                            title="Remove template by-product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="p-3 space-y-3">
                          {templateByProductItems.map((item) => {
                              const editKey = `tbp-${item.id}`;
                              const isEditing =
                                editingSharedProductItemKey === editKey;
                              return (
                                <div
                                  key={item.id}
                                  className="border rounded-lg p-3 bg-gray-50"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 flex-1">
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-semibold ${
                                          item.type === "raw_material"
                                            ? "bg-orange-100 text-orange-800 border border-orange-200"
                                            : item.type === "semi_finished"
                                            ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                            : item.type === "by_product_credit"
                                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                                            : "bg-gray-100 text-gray-800 border border-gray-200"
                                        }`}
                                      >
                                        {item.type === "raw_material"
                                          ? "RM"
                                          : item.type === "semi_finished"
                                          ? "SF"
                                          : item.type === "by_product_credit"
                                          ? "BP"
                                          : "Other"}
                                      </span>
                                      <div className="flex-1">
                                        <span className="font-medium text-gray-900">
                                          {item.description}
                                        </span>
                                        {(item.type === "other" ||
                                          item.type === "by_product_credit") &&
                                          item.account_head && (
                                            <div className="text-xs text-gray-500 mt-0.5">
                                              Account: {item.account_head}
                                              {item.description_code &&
                                                ` (${item.description_code})`}
                                            </div>
                                          )}
                                        {(item.type === "raw_material" ||
                                          item.type === "semi_finished") &&
                                          item.raw_material_sku && (
                                            <div className="text-xs text-gray-500 mt-0.5">
                                              SKU: {item.raw_material_sku}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isEditing ? (
                                        <div className="flex flex-wrap gap-2 items-center">
                                          {item.type === "raw_material" ||
                                          item.type === "semi_finished" ? (
                                            <>
                                              <div className="flex flex-col gap-0.5">
                                                <small className="text-xs text-gray-500">
                                                  Qty
                                                </small>
                                                <Input
                                                  type="number"
                                                  step="0.0001"
                                                  min="0"
                                                  value={item.quantity ?? ""}
                                                  onChange={(e) => {
                                                    const val = e.target.value;
                                                    handleUpdateTemplateByProductItem(item.id,
                                                      {
                                                        quantity:
                                                          val === "" ? 0 : parseFloat(val) || 0,
                                                      }
                                                    );
                                                  }}
                                                  className="form-control form-control-sm text-center"
                                                  style={{ width: "70px" }}
                                                />
                                              </div>
                                              <div className="flex flex-col gap-0.5">
                                                <small className="text-xs text-gray-500">
                                                  Cost (₦)
                                                </small>
                                                <Input
                                                  type="text"
                                                  value={formatNumberWithCommas(
                                                    item.rate || ""
                                                  )}
                                                  onChange={(e) => {
                                                    const val = e.target.value.replace(
                                                      /[,]/g,
                                                      ""
                                                    );
                                                    handleUpdateTemplateByProductItem(item.id,
                                                      { rate: val }
                                                    );
                                                  }}
                                                  className="form-control form-control-sm text-center"
                                                  style={{ width: "90px" }}
                                                  placeholder="Rate"
                                                />
                                              </div>
                                            </>
                                          ) : item.other_type === "rate" ? (
                                            <div className="flex flex-col gap-0.5">
                                              <small className="text-xs text-gray-500">
                                                Rate (₦)
                                              </small>
                                              <Input
                                                type="text"
                                                value={formatNumberWithCommas(
                                                  item.rate || ""
                                                )}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(
                                                    /[,]/g,
                                                    ""
                                                  );
                                                  handleUpdateTemplateByProductItem(item.id,
                                                    { rate: val }
                                                  );
                                                }}
                                                className="form-control form-control-sm text-center"
                                                style={{ width: "90px" }}
                                                placeholder="Rate"
                                              />
                                            </div>
                                          ) : item.other_type === "percentage" ? (
                                            <div className="flex flex-col gap-0.5">
                                              <small className="text-xs text-gray-500">
                                                %
                                              </small>
                                              <Input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                max="100"
                                                value={item.quantity ?? ""}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  handleUpdateTemplateByProductItem(item.id,
                                                    {
                                                      quantity:
                                                        val === "" ? 0 : parseFloat(val) || 0,
                                                    }
                                                  );
                                                }}
                                                className="form-control form-control-sm text-center"
                                                style={{ width: "60px" }}
                                                placeholder="%"
                                              />
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <>
                                          <span className="text-sm text-gray-600 font-medium">
                                            {item.type === "raw_material" ||
                                            item.type === "semi_finished" ? (
                                              <span className="flex flex-col items-end gap-0.5 text-right">
                                                <span>
                                                  Qty: {formatQuantity(item.quantity)}
                                                </span>
                                                {(item.rate != null &&
                                                  item.rate !== "") && (
                                                  <span>
                                                    Cost: ₦
                                                    {formatNumber1(item.rate)}
                                                  </span>
                                                )}
                                              </span>
                                            ) : item.other_type === "rate" ? (
                                              `₦${formatNumber1(item.rate)}`
                                            ) : item.other_type === "percentage" ? (
                                              `${item.quantity}%`
                                            ) : (
                                              formatQuantity(item.quantity)
                                            )}
                                          </span>
                                          {(item.type === "other" ||
                                            item.type === "by_product_credit") &&
                                            item.other_type === "percentage" &&
                                            item.percentage_basis && (
                                              <span className="text-xs text-gray-500">
                                                (
                                                {item.percentage_basis ===
                                                "raw_material"
                                                  ? "RM"
                                                  : "All"}
                                                )
                                              </span>
                                            )}
                                        </>
                                      )}
                                      {(item.type === "raw_material" ||
                                        item.type === "semi_finished" ||
                                        (item.type === "other" ||
                                          item.type === "by_product_credit") &&
                                          (item.other_type === "rate" ||
                                            item.other_type === "percentage")) && (
                                        <button
                                          onClick={() =>
                                            setEditingSharedProductItemKey(
                                              isEditing ? null : editKey
                                            )
                                          }
                                          className={`p-1 rounded ${
                                            isEditing
                                              ? "text-green-600 hover:bg-green-50"
                                              : "text-blue-600 hover:bg-blue-50"
                                          }`}
                                          title={
                                            isEditing
                                              ? "Save and close"
                                              : "Edit item"
                                          }
                                        >
                                          {isEditing ? (
                                            <Save size={16} />
                                          ) : (
                                            <Edit size={16} />
                                          )}
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleRemoveTemplateByProductItem(item.id)
                                        }
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                        title="Remove item"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                          })}

                          {/* Add Item Form */}
                          {renderSharedProductAddItemPanel(
                            TEMPLATE_BY_PRODUCT_LINE_INDEX,
                          )}
                        </div>
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Products Section */}
                  <div className="border rounded p-3 bg-gray-50">
                    <h4 className="font-semibold text-gray-700 mb-3">
                      Products
                    </h4>

                    {/* Add Product */}
                    <div className="flex gap-2 mb-3">
                      <div className="flex-1">
                        <TypeaheadCustom
                          options={finishedGoodProducts.filter(
                            (p) =>
                              !sharedProducts.some(
                                (sp) => sp.product.id === p.id
                              )
                          )}
                          placeholder="Select product to add..."
                          labelKey={(p) => `${p.name} (${p.sku || p.id})`}
                          onChange={(sel) => setSelectedProduct(sel[0] || null)}
                          selected={selectedProduct ? [selectedProduct] : []}
                        />
                      </div>
                      <Button
                        size="sm"
                        color="primary"
                        onClick={handleAddSharedProduct}
                        disabled={!selectedProduct}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>

                    {/* Products List */}
                    {sharedProducts.map((sp, pIndex) => (
                      <div
                        key={sp.product.id}
                        className="mb-4 border rounded-lg bg-white shadow-sm"
                      >
                        {/* Product Header */}
                        <div className="flex justify-between items-center p-3 border-b bg-gray-50">
                          <div className="flex items-center gap-4 flex-1">
                            <div>
                              <span className="font-bold text-gray-900 text-base">
                                {sp.product.name}
                              </span>
                              <span className="text-sm text-gray-500 ml-2">
                                ({sp.product.sku || sp.product.id})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-semibold text-gray-700">
                                Units:
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={sp.multiple || ""}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  setSharedProducts((prev) =>
                                    prev.map((prod, idx) =>
                                      idx === pIndex
                                        ? { ...prod, multiple: value }
                                        : prod
                                    )
                                  );
                                }}
                                className="h-8 w-32 px-2 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                placeholder="Enter value"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveSharedProduct(pIndex)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors"
                            title="Remove product"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Product Items List */}
                        <div className="p-3 space-y-3">
                          {sp.items.map((item) => {
                            const editKey = `${pIndex}-${item.id}`;
                            const isEditing =
                              editingSharedProductItemKey === editKey;
                            return (
                              <div
                                key={item.id}
                                className="border rounded-lg p-3 bg-gray-50"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3 flex-1">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${
                                        item.type === "raw_material"
                                          ? "bg-orange-100 text-orange-800 border border-orange-200"
                                          : item.type === "semi_finished"
                                          ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                          : item.type === "by_product_credit"
                                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                                          : "bg-gray-100 text-gray-800 border border-gray-200"
                                      }`}
                                    >
                                      {item.type === "raw_material"
                                        ? "RM"
                                        : item.type === "semi_finished"
                                        ? "SF"
                                        : item.type === "by_product_credit"
                                        ? "BP"
                                        : "Other"}
                                    </span>
                                    <div className="flex-1">
                                      <span className="font-medium text-gray-900">
                                        {item.description}
                                      </span>
                                      {(item.type === "other" ||
                                        item.type === "by_product_credit") &&
                                        item.account_head && (
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            Account: {item.account_head}
                                            {item.description_code &&
                                              ` (${item.description_code})`}
                                          </div>
                                        )}
                                      {(item.type === "raw_material" ||
                                        item.type === "semi_finished") &&
                                        item.raw_material_sku && (
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            SKU: {item.raw_material_sku}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isEditing ? (
                                      <div className="flex flex-wrap gap-2 items-center">
                                        {item.type === "raw_material" ||
                                        item.type === "semi_finished" ? (
                                          <>
                                            <div className="flex flex-col gap-0.5">
                                              <small className="text-xs text-gray-500">
                                                Qty
                                              </small>
                                              <Input
                                                type="number"
                                                step="0.0001"
                                                min="0"
                                                value={item.quantity ?? ""}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  handleUpdateSharedProductItem(
                                                    pIndex,
                                                    item.id,
                                                    {
                                                      quantity:
                                                        val === "" ? 0 : parseFloat(val) || 0,
                                                    }
                                                  );
                                                }}
                                                className="form-control form-control-sm text-center"
                                                style={{ width: "70px" }}
                                              />
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                              <small className="text-xs text-gray-500">
                                                Cost (₦)
                                              </small>
                                              <Input
                                                type="text"
                                                value={formatNumberWithCommas(
                                                  item.rate || ""
                                                )}
                                                onChange={(e) => {
                                                  const val = e.target.value.replace(
                                                    /[,]/g,
                                                    ""
                                                  );
                                                  handleUpdateSharedProductItem(
                                                    pIndex,
                                                    item.id,
                                                    { rate: val }
                                                  );
                                                }}
                                                className="form-control form-control-sm text-center"
                                                style={{ width: "90px" }}
                                                placeholder="Rate"
                                              />
                                            </div>
                                          </>
                                        ) : item.other_type === "rate" ? (
                                          <div className="flex flex-col gap-0.5">
                                            <small className="text-xs text-gray-500">
                                              Rate (₦)
                                            </small>
                                            <Input
                                              type="text"
                                              value={formatNumberWithCommas(
                                                item.rate || ""
                                              )}
                                              onChange={(e) => {
                                                const val = e.target.value.replace(
                                                  /[,]/g,
                                                  ""
                                                );
                                                handleUpdateSharedProductItem(
                                                  pIndex,
                                                  item.id,
                                                  { rate: val }
                                                );
                                              }}
                                              className="form-control form-control-sm text-center"
                                              style={{ width: "90px" }}
                                              placeholder="Rate"
                                            />
                                          </div>
                                        ) : item.other_type === "percentage" ? (
                                          <div className="flex flex-col gap-0.5">
                                            <small className="text-xs text-gray-500">
                                              %
                                            </small>
                                            <Input
                                              type="number"
                                              step="0.0001"
                                              min="0"
                                              max="100"
                                              value={item.quantity ?? ""}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                handleUpdateSharedProductItem(
                                                  pIndex,
                                                  item.id,
                                                  {
                                                    quantity:
                                                      val === "" ? 0 : parseFloat(val) || 0,
                                                  }
                                                );
                                              }}
                                              className="form-control form-control-sm text-center"
                                              style={{ width: "60px" }}
                                              placeholder="%"
                                            />
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-sm text-gray-600 font-medium">
                                          {item.type === "raw_material" ||
                                          item.type === "semi_finished" ? (
                                            <span className="flex flex-col items-end gap-0.5 text-right">
                                              <span>
                                                Qty: {formatQuantity(item.quantity)}
                                              </span>
                                              {(item.rate != null &&
                                                item.rate !== "") && (
                                                <span>
                                                  Cost: ₦
                                                  {formatNumber1(item.rate)}
                                                </span>
                                              )}
                                            </span>
                                          ) : item.other_type === "rate" ? (
                                            `₦${formatNumber1(item.rate)}`
                                          ) : item.other_type === "percentage" ? (
                                            `${item.quantity}%`
                                          ) : (
                                            formatQuantity(item.quantity)
                                          )}
                                        </span>
                                        {(item.type === "other" ||
                                          item.type === "by_product_credit") &&
                                          item.other_type === "percentage" &&
                                          item.percentage_basis && (
                                            <span className="text-xs text-gray-500">
                                              (
                                              {item.percentage_basis ===
                                              "raw_material"
                                                ? "RM"
                                                : "All"}
                                              )
                                            </span>
                                          )}
                                      </>
                                    )}
                                    {(item.type === "raw_material" ||
                                      item.type === "semi_finished" ||
                                      (item.type === "other" ||
                                        item.type === "by_product_credit") &&
                                        (item.other_type === "rate" ||
                                          item.other_type === "percentage")) && (
                                      <button
                                        onClick={() =>
                                          setEditingSharedProductItemKey(
                                            isEditing ? null : editKey
                                          )
                                        }
                                        className={`p-1 rounded ${
                                          isEditing
                                            ? "text-green-600 hover:bg-green-50"
                                            : "text-blue-600 hover:bg-blue-50"
                                        }`}
                                        title={
                                          isEditing
                                            ? "Save and close"
                                            : "Edit item"
                                        }
                                      >
                                        {isEditing ? (
                                          <Save size={16} />
                                        ) : (
                                          <Edit size={16} />
                                        )}
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        handleRemoveItemFromSharedProduct(
                                          pIndex,
                                          item.id
                                        )
                                      }
                                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      title="Remove item"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Add Item Form */}
                          {renderSharedProductAddItemPanel(pIndex)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t bg-gray-50 p-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium"
                    disabled={loading}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitSharedCosting}
                    disabled={
                      loading ||
                      !sharedCostingName.trim() ||
                      sharedProducts.length === 0
                    }
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="spinner-border spinner-border-sm" />{" "}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />{" "}
                        {editingSharedGroupId ? "Update" : "Submit Shared Costing"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

export default CostingTemplate;
