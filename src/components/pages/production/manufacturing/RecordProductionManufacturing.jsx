import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import moment from "moment";
import { toast } from "sonner";
import { Typeahead } from "react-bootstrap-typeahead";
import CreatableSelect from "react-select/creatable";
import Select from "react-select";
import {
  Trash2,
  Plus,
  Factory,
  Package,
  Settings,
  Calendar,
  FileText,
  CheckCircle,
  X,
  Save,
  ArrowLeft,
  HelpCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  formatNumber,
  resolveDefaultBranchLocationId,
  sortBranchesByFirstCreated,
} from "@/utilities";
import TypeaheadCustom from "@/common/Custom/TypeaheadCustom";
import TemplateByProductSection from "@/components/pages/sales/TemplateByProductSection";
import {
  mapTemplateByProductItem,
  mapTemplateByProductItemToPayload,
  resolveRawMaterialProductFromList,
  resolveTemplateByProductHeaderUnitCost,
  computeSharedCostScaleFromRawMaterials,
  normalizeSharedCostQtyUse,
} from "@/hooks/useTemplateByProduct";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button as UIButton } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

const SHORTFALL_REASONS = [
  "Engine failure",
  "Electricity outage",
  "Raw material shortage",
  "Operator issue",
  "Machine maintenance",
];

const handleNumericInput = (value) =>
  String(value ?? "").replace(/[^0-9.,]/g, "");

/** Keep typed decimals (including trailing ".") — Number()→String() strips them. */
const sanitizeDecimalQtyInput = (value) => {
  const withoutCommas = String(value ?? "").replace(/,/g, "");
  const sanitized = handleNumericInput(withoutCommas);
  const parts = sanitized.split(".");
  return parts.length > 2
    ? `${parts[0]}.${parts.slice(1).join("")}`
    : sanitized;
};

/**
 * Clamp a qty string only when it's a complete number.
 * Intermediate values like "12." or ".5" are preserved while typing.
 */
const applyDecimalQtyBounds = (raw, { min = 0, max = null } = {}) => {
  const sanitized = sanitizeDecimalQtyInput(raw);
  if (sanitized === "" || sanitized === ".") {
    return sanitized === "." ? "0." : "";
  }
  if (sanitized.endsWith(".")) return sanitized;
  const n = parseFloat(sanitized);
  if (!Number.isFinite(n)) return sanitized;
  if (n < min) return String(min);
  if (max != null && Number.isFinite(max) && n > max) {
    return String(max);
  }
  return sanitized;
};

function wasteTypePillClass(wasteType) {
  const t = String(wasteType || "")
    .trim()
    .toLowerCase();
  if (t === "abnormal") return "bg-rose-100 text-rose-800 border-rose-200";
  if (t === "recyclable" || t === "recycled" || t === "recycle") {
    return "bg-amber-100 text-amber-900 border-amber-200";
  }
  if (t === "normal") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-white text-gray-600 border-gray-300";
}

function createOperatorEntry(overrides = {}) {
  return {
    id: overrides.id || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    engineName: overrides.engineName ?? "",
    operator: overrides.operator ?? "",
    goodQuantity: overrides.goodQuantity ?? "",
    wasteQuantity: overrides.wasteQuantity ?? "",
    wasteType: overrides.wasteType ?? "",
    wasteScrapByProductSelection: overrides.wasteScrapByProductSelection ?? [],
    wasteAbnormalLossExpenseSelection:
      overrides.wasteAbnormalLossExpenseSelection ?? [],
    wasteReason: overrides.wasteReason ?? "",
  };
}

function sumOperatorEntries(entries = []) {
  return (entries || []).reduce(
    (acc, entry) => {
      const good = parseFloat(entry?.goodQuantity) || 0;
      const waste = parseFloat(entry?.wasteQuantity) || 0;
      const isRecyclable =
        String(entry?.wasteType || "")
          .trim()
          .toLowerCase() === "recyclable";
      return {
        good: acc.good + good,
        waste: acc.waste + waste,
        recycled: acc.recycled + (isRecyclable ? waste : 0),
      };
    },
    { good: 0, waste: 0, recycled: 0 },
  );
}

function getOperatorQtyCap(fg, isResumeMode) {
  const expectedQty = Number(fg?.expectedQty || 0);
  const remainingCap =
    isResumeMode &&
    fg?.remainingQty !== undefined &&
    fg?.remainingQty !== null
      ? Number(fg.remainingQty || 0)
      : null;
  if (remainingCap != null && remainingCap >= 0) return remainingCap;
  if (expectedQty > 0) return expectedQty;
  return null;
}

function clampOperatorEntriesToCap(
  entries,
  cap,
  { editedEntryId, editedField } = {},
) {
  if (cap == null || !Number.isFinite(cap) || cap < 0) return entries;
  let result = (entries || []).map((e) => ({ ...e }));

  if (
    editedEntryId &&
    (editedField === "goodQuantity" || editedField === "wasteQuantity")
  ) {
    const idx = result.findIndex((e) => e.id === editedEntryId);
    if (idx >= 0) {
      const othersTotal = result.reduce((sum, e, i) => {
        if (i === idx) return sum;
        return (
          sum +
          (parseFloat(e.goodQuantity) || 0) +
          (parseFloat(e.wasteQuantity) || 0)
        );
      }, 0);
      // Same row: Good + Waste share one Expected Qty budget
      const sameRowOther =
        editedField === "goodQuantity"
          ? parseFloat(result[idx].wasteQuantity) || 0
          : parseFloat(result[idx].goodQuantity) || 0;
      const maxForField = Math.max(cap - othersTotal - sameRowOther, 0);
      const raw = String(result[idx][editedField] ?? "").trim();
      if (raw === "") {
        result[idx] = { ...result[idx], [editedField]: "" };
      } else {
        const requested = parseFloat(raw);
        const safe = Number.isFinite(requested)
          ? Math.min(Math.max(requested, 0), maxForField)
          : 0;
        result[idx] = {
          ...result[idx],
          [editedField]: String(safe),
        };
      }
    }
    // Final safety: re-clamp whole set if somehow still over
    const check = sumOperatorEntries(result);
    if (check.good + check.waste > cap) {
      return clampOperatorEntriesToCap(result, cap, {});
    }
    return result;
  }

  let { good, waste } = sumOperatorEntries(result);
  if (good + waste <= cap + 1e-9) return result;

  let overflow = good + waste - cap;
  for (let i = result.length - 1; i >= 0 && overflow > 1e-9; i -= 1) {
    const w = parseFloat(result[i].wasteQuantity) || 0;
    if (w > 0) {
      const cut = Math.min(w, overflow);
      result[i] = {
        ...result[i],
        wasteQuantity: String(Math.max(w - cut, 0)),
      };
      overflow -= cut;
    }
  }
  for (let i = result.length - 1; i >= 0 && overflow > 1e-9; i -= 1) {
    const g = parseFloat(result[i].goodQuantity) || 0;
    if (g > 0) {
      const cut = Math.min(g, overflow);
      result[i] = {
        ...result[i],
        goodQuantity: String(Math.max(g - cut, 0)),
      };
      overflow -= cut;
    }
  }
  return result;
}

function getMaxQtyForOperatorField(entries, entryId, field, cap) {
  if (cap == null || !Number.isFinite(cap)) return undefined;
  const list = entries || [];
  const othersTotal = list.reduce((sum, e) => {
    if (e.id === entryId) return sum;
    return (
      sum +
      (parseFloat(e.goodQuantity) || 0) +
      (parseFloat(e.wasteQuantity) || 0)
    );
  }, 0);
  const row = list.find((e) => e.id === entryId);
  const sameRowOther =
    field === "goodQuantity"
      ? parseFloat(row?.wasteQuantity) || 0
      : parseFloat(row?.goodQuantity) || 0;
  return Math.max(cap - othersTotal - sameRowOther, 0);
}

function syncFgWasteMetaFromEntries(fg) {
  const entries = fg?.operatorEntries || [];
  const wasteRows = entries.filter((e) => (parseFloat(e.wasteQuantity) || 0) > 0);
  if (!wasteRows.length) {
    return {
      ...fg,
      wasteType: "",
      wasteScrapByProductSelection: [],
      wasteAbnormalLossExpenseSelection: [],
      recycledQuantity: 0,
    };
  }
  const hasRecyclable = wasteRows.some(
    (e) =>
      String(e.wasteType || "")
        .trim()
        .toLowerCase() === "recyclable",
  );
  const firstRecyclable = wasteRows.find(
    (e) =>
      String(e.wasteType || "")
        .trim()
        .toLowerCase() === "recyclable",
  );
  const firstAbnormal = wasteRows.find(
    (e) =>
      String(e.wasteType || "")
        .trim()
        .toLowerCase() === "abnormal",
  );
  const { recycled } = sumOperatorEntries(entries);
  return {
    ...fg,
    wasteType: hasRecyclable
      ? "recyclable"
      : wasteRows[0]?.wasteType || "normal",
    wasteScrapByProductSelection:
      firstRecyclable?.wasteScrapByProductSelection ||
      fg.wasteScrapByProductSelection ||
      [],
    wasteAbnormalLossExpenseSelection:
      firstAbnormal?.wasteAbnormalLossExpenseSelection ||
      (firstAbnormal
        ? fg.wasteAbnormalLossExpenseSelection || []
        : []),
    wasteReason: wasteRows.map((e) => e.wasteReason).filter(Boolean).join("; "),
    recycledQuantity: recycled,
  };
}

/** Keep FG good/waste/operator in sync with operator production rows. */
function applyOperatorEntryTotals(fg, formatNumberWithCommasFn) {
  const entries =
    Array.isArray(fg?.operatorEntries) && fg.operatorEntries.length
      ? fg.operatorEntries
      : [
          createOperatorEntry({
            operator: fg?.operator || "",
            goodQuantity: fg?.goodQuantity || "",
            wasteQuantity: fg?.wasteQuantity || "",
          }),
        ];
  const { good, waste, recycled } = sumOperatorEntries(entries);
  const goodStr = String(good);
  const names = entries
    .map((e) => String(e.operator || "").trim())
    .filter(Boolean);
  const base = {
    ...fg,
    operatorEntries: entries,
    goodQuantity: goodStr,
    wasteQuantity: String(waste),
    recycledQuantity: recycled,
    quantity: goodStr,
    quantity_formatted: formatNumberWithCommasFn
      ? formatNumberWithCommasFn(goodStr)
      : goodStr,
    operator: names.join(", "),
  };
  return syncFgWasteMetaFromEntries(base);
}

function createEmptyFinishedGood(overrides = {}) {
  const base = {
    id: Date.now() + 1,
    finishedGood: null,
    operator: "",
    operatorEntries: [createOperatorEntry()],
    expectedQty: "",
    goodQuantity: "",
    wasteQuantity: "",
    previousGoodQuantity: 0,
    previousWasteQuantity: 0,
    wasteType: "",
    wasteReason: "",
    wasteScrapByProductSelection: [],
    wasteAbnormalLossExpenseSelection: [],
    shortfallReason: "",
    sessionStartTime: "",
    sessionEndTime: "",
    multiplier: null,
    multiplierValue: 1.0,
    quantity: "",
    quantity_formatted: "",
    units: null,
    batchNo: "",
    warehouse: "",
    unitOfMeasure: "",
    category: "",
    branchLocationId: null,
    branch_id: "",
    branch_name: "",
    ...overrides,
  };
  if (!Array.isArray(base.operatorEntries) || !base.operatorEntries.length) {
    base.operatorEntries = [
      createOperatorEntry({
        operator: base.operator || "",
        goodQuantity: base.goodQuantity || "",
        wasteQuantity: base.wasteQuantity || "",
      }),
    ];
  }
  return base;
}

export default function RecordProductionManufacturing() {
  const { activeBusiness, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [batchNo, setBatchNo] = useState("");
  const [resumeSessionHistory, setResumeSessionHistory] = useState(null);
  const [isResumeMode, setIsResumeMode] = useState(false);
  const [sessionHistory, setSessionHistory] = useState([]);

  // Get costing type from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const costingType = urlParams.get("type") || "job_specific"; // default to job_specific
  const resumeBatchId = urlParams.get("resumeBatch");

  const [form, setForm] = useState({
    productionDate: "",
    productionLine: "",
    notes: "",
  });
  const [errors, setErrors] = useState({
    productionDate: "",
    productionLine: "",
    notes: "",
  });

  const [productionItems, setProductionItems] = useState([
    {
      id: Date.now(),
      type: costingType, // Add type to production items
      engineName: "",
      finishedGoods: [createEmptyFinishedGood({ id: Date.now() + 1 })],
      ingredients: [
        {
          id: Date.now() + 2,
          product: null,
          quantity: "",
          actualQty: "",
          unitOfMeasure: "",
          availableQty: 0,
        },
      ],
      sharedCosts: [], // Add shared costs for joint_shared type
    },
  ]);

  const [finishedGoodProducts, setFinishedGoodProducts] = useState([]);
  /** By-Product–type rows (same source as ProductList: /api/products, item_type === "By-Product") for recyclable waste */
  const [byProductWasteOptions, setByProductWasteOptions] = useState([]);
  const [rawMaterialProducts, setRawMaterialProducts] = useState([]);
  const [rawMaterialCatalog, setRawMaterialCatalog] = useState([]);
  const [operatorTeams, setOperatorTeams] = useState([]);
  const [productGroups, setProductGroups] = useState([]); // Add product groups for joint_shared
  // Expected template drives the production structure + expected raw-material qty.
  const [selectedProductGroup, setSelectedProductGroup] = useState(null);
  // Actual template optionally overrides actual usage qty per raw material line.
  const [selectedActualProductGroup, setSelectedActualProductGroup] =
    useState(null);
  const [sharedCostsFromGroup, setSharedCostsFromGroup] = useState([]);
  const [sharedCostOutputPercentage, setSharedCostOutputPercentage] =
    useState(1);
  const [expenseList, setExpenseList] = useState([]);
  const [productionDefaultAccounts, setProductionDefaultAccounts] =
    useState(null);
  const [newSharedRawMaterial, setNewSharedRawMaterial] = useState({
    product: null,
    quantity: "",
  }); // State for new shared raw material
  const [allMultipliers, setAllMultipliers] = useState([]);
  const [sharedCostQtyUse, setSharedCostQtyUse] = useState(1); // Qty use multiplier for shared costs
  /** Section-level joint/shared batch waste (whole production, not per raw-material row) */
  const [sharedJointWasteType, setSharedJointWasteType] = useState("normal");
  const [
    sharedJointScrapByProductSelection,
    setSharedJointScrapByProductSelection,
  ] = useState([]);
  /** When waste type is By-Product: cost and qty for the selected scrap/by-product */
  const [sharedJointScrapCost, setSharedJointScrapCost] = useState("");
  const [sharedJointScrapQty, setSharedJointScrapQty] = useState("");
  const [selectedTemplateByProduct, setSelectedTemplateByProduct] =
    useState(null);
  const [templateByProductQty, setTemplateByProductQty] = useState("0");
  const [templateByProductUnitCost, setTemplateByProductUnitCost] =
    useState("");
  const [templateByProductItems, setTemplateByProductItems] = useState([]);
  const [templateByProductOptions, setTemplateByProductOptions] = useState([]);
  const [pendingTemplateByProductMeta, setPendingTemplateByProductMeta] =
    useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [templateByProductBranchId, setTemplateByProductBranchId] =
    useState("");

  const clearTemplateByProductState = () => {
    setSelectedTemplateByProduct(null);
    setTemplateByProductQty("1");
    setTemplateByProductUnitCost("");
    setTemplateByProductItems([]);
    setPendingTemplateByProductMeta(null);
    setTemplateByProductBranchId("");
  };

  const getResolvedTemplateByProductBranchId = useCallback(
    (items = productionItems) => {
      const fgBranchId = items
        .flatMap((pi) => pi.finishedGoods || [])
        .map((fg) => fg.branchLocationId)
        .find(
          (id) =>
            id != null &&
            String(id).trim() !== "" &&
            String(id) !== "0" &&
            branchOptions.some((b) => String(b.id) === String(id)),
        );
      return resolveDefaultBranchLocationId(
        templateByProductBranchId || fgBranchId,
        branchOptions,
      );
    },
    [productionItems, templateByProductBranchId, branchOptions],
  );

  const normalizeByProductOption = (p) => ({
    id: p.id,
    name: p.name || p.item_name || "",
    item_name: p.name || p.item_name || "",
    sku: p.sku || p.item_code || "",
    item_code: p.item_code || p.sku || "",
    cost_price: p.cost_price,
    inventory_account: p.inventory_account || "",
    item_type: p.item_type || "By-Product",
  });

  const loadTemplateByProductOptions = useCallback(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/inventory/by-products?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success && Array.isArray(resp.results)) {
          setTemplateByProductOptions(
            resp.results.map(normalizeByProductOption),
          );
        } else {
          setTemplateByProductOptions([]);
        }
      },
      () => setTemplateByProductOptions([]),
    );
  }, [activeBusiness?.id]);

  const loadBranches = useCallback(() => {
    if (!activeBusiness?.id) {
      setBranchesLoading(false);
      setBranchOptions([]);
      return;
    }
    setBranchesLoading(true);
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success && Array.isArray(resp.results)) {
          setBranchOptions(sortBranchesByFirstCreated(resp.results));
        } else {
          setBranchOptions([]);
        }
        setBranchesLoading(false);
      },
      () => {
        setBranchOptions([]);
        setBranchesLoading(false);
      },
    );
  }, [activeBusiness?.id]);

  const getRmAvailableQty = (product) =>
    parseFloat(
      product?.quantity ??
        product?.qty ??
        product?.available_qty ??
        product?.available_quantity ??
        product?.balance ??
        product?.stock_quantity ??
        0,
    ) || 0;

  const getIngredientIdentityKeys = (ingredientOrProduct) => {
    const src = ingredientOrProduct?.product
      ? {
          ...ingredientOrProduct.product,
          rawMaterialSku: ingredientOrProduct.rawMaterialSku,
          raw_material_sku: ingredientOrProduct.raw_material_sku,
          rawMaterialId: ingredientOrProduct.rawMaterialId,
          raw_material_id: ingredientOrProduct.raw_material_id,
        }
      : ingredientOrProduct || {};
    return [
      src.item_code,
      src.sku,
      src.product_id,
      src.id,
      src.rawMaterialSku,
      src.raw_material_sku,
      src.rawMaterialId,
      src.raw_material_id,
    ]
      .map((v) => String(v ?? "").trim().toLowerCase())
      .filter(Boolean);
  };

  const findWipProductMatch = (ingredientOrProduct, wipList = rawMaterialProducts) => {
    const keys = new Set(getIngredientIdentityKeys(ingredientOrProduct));
    if (!keys.size) return null;
    const matches = (wipList || []).filter((rm) =>
      [rm.item_code, rm.sku, rm.product_id, rm.id]
        .map((v) => String(v ?? "").trim().toLowerCase())
        .some((k) => k && keys.has(k)),
    );
    if (!matches.length) return null;
    return matches.reduce((best, cur) =>
      getRmAvailableQty(cur) > getRmAvailableQty(best) ? cur : best,
    );
  };

  const formatRmSelectLabel = (product) => {
    if (!product) return "";
    return `${product.item_name || product.name || "N/A"} (${
      product.item_code || product.sku || "N/A"
    }) - ${product.unit_of_measure || "-"} - Avail: ${getRmAvailableQty(product).toFixed(4)}`;
  };

  const enrichTemplateByProductItem = (item, _unitsOverride) => {
    const mapped = mapTemplateByProductItem(item);
    const { product, matchedInWip } = resolveRawMaterialProductFromList(
      mapped,
      rawMaterialProducts,
      item.product,
      rawMaterialCatalog,
    );
    const availableQty = product && matchedInWip ? getRmAvailableQty(product) : 0;
    const existingActual =
      item.actualQty !== undefined &&
      item.actualQty !== null &&
      item.actualQty !== ""
        ? String(item.actualQty)
        : "";
    return {
      ...mapped,
      product: product || null,
      description:
        mapped.description || product?.item_name || product?.name || "",
      raw_material_sku:
        mapped.raw_material_sku || product?.item_code || product?.sku || "",
      raw_material_id:
        mapped.raw_material_id || product?.product_id || product?.id || "",
      availableQty,
      isOutOfWipStock: Boolean(product && !matchedInWip),
      actualQty: existingActual || "0",
    };
  };

  const resolveTemplateByProductSelection = (
    pid,
    pname,
    psku,
    itemCode,
    options = templateByProductOptions,
  ) => {
    const idStr = pid != null && pid !== "" ? String(pid) : "";
    const skuStr = String(psku || itemCode || "")
      .trim()
      .toLowerCase();
    const lists = [
      ...(Array.isArray(options) ? options : []),
      ...byProductWasteOptions.map(normalizeByProductOption),
    ];
    const fromList = lists.find((p) => {
      if (idStr) {
        if (String(p.id) === idStr) return true;
        if (String(p.product_id || "") === idStr) return true;
      }
      const codes = [p.item_code, p.sku]
        .filter(Boolean)
        .map((c) => String(c).trim().toLowerCase());
      if (skuStr && codes.some((c) => c === skuStr)) return true;
      return false;
    });
    if (fromList) return normalizeByProductOption(fromList);
    if (!idStr && !pname && !skuStr) return null;
    return normalizeByProductOption({
      id: pid,
      name: pname,
      item_name: pname,
      sku: psku || itemCode || "",
      item_code: itemCode || psku || "",
    });
  };

  const applyTemplateByProductFromCostingData = (costingData, defaultUnits) => {
    const tbp =
      costingData?.templateByProduct ||
      costingData?.template_by_product ||
      costingData?.TemplateByProduct;
    if (!tbp || typeof tbp !== "object") {
      clearTemplateByProductState();
      return;
    }
    const pid = tbp.productId ?? tbp.product_id;
    const pname = tbp.productName ?? tbp.product_name ?? "";
    const psku = tbp.productSku ?? tbp.product_sku ?? tbp.item_code ?? "";
    const itemCode = tbp.item_code || psku;
    if (pid != null && pid !== "") {
      const resolved = resolveTemplateByProductSelection(
        pid,
        pname,
        psku,
        itemCode,
      );
      const matchedFromApi =
        templateByProductOptions.length > 0 &&
        templateByProductOptions.some(
          (p) =>
            String(p.id) === String(pid) ||
            String(p.item_code || p.sku || "")
              .trim()
              .toLowerCase() ===
              String(psku || itemCode || "")
                .trim()
                .toLowerCase(),
        );
      if (resolved && matchedFromApi) {
        setSelectedTemplateByProduct(resolved);
        setPendingTemplateByProductMeta(null);
      } else {
        setPendingTemplateByProductMeta({ pid, pname, psku, itemCode });
        setSelectedTemplateByProduct(resolved);
      }
    } else {
      setSelectedTemplateByProduct(null);
      setPendingTemplateByProductMeta(null);
    }
    const u = tbp.units ?? tbp.qty ?? tbp.multiple;
    const units =
      u != null && u !== ""
        ? Math.max(parseFloat(u) || 1, 1)
        : defaultUnits != null && defaultUnits !== ""
          ? normalizeSharedCostQtyUse(defaultUnits)
          : 1;
    setTemplateByProductQty(String(units));
    const uc = tbp.unit_cost ?? tbp.unitCost;
    setTemplateByProductUnitCost(uc != null && uc !== "" ? String(uc) : "");
    const tItems = tbp.items || tbp.Items || [];
    setTemplateByProductItems(
      (Array.isArray(tItems) ? tItems : [])
        .map(mapTemplateByProductItem)
        .map((item) =>
          (item.type || "raw_material") === "raw_material"
            ? enrichTemplateByProductItem(item, units)
            : item,
        ),
    );
    const brLoc =
      tbp.branchLocationId ??
      tbp.branch_location_id ??
      tbp.branchRowId ??
      tbp.branch_row_id;
    if (brLoc != null && brLoc !== "") {
      setTemplateByProductBranchId(String(brLoc));
    } else {
      setTemplateByProductBranchId(
        resolveDefaultBranchLocationId("", branchOptions),
      );
    }
  };

  const buildTemplateByProductPayload = () => {
    if (!selectedTemplateByProduct) return null;
    const units = parseFloat(
      String(templateByProductQty || "1").replace(/,/g, ""),
    );
    const unitCost = resolveTemplateByProductHeaderUnitCost(
      templateByProductUnitCost,
      selectedTemplateByProduct,
    );
    const resolvedBranchId = getResolvedTemplateByProductBranchId();
    const branchRow = branchOptions.find(
      (b) => String(b.id) === String(resolvedBranchId),
    );
    const branchPayload =
      branchRow && resolvedBranchId
        ? {
            branchLocationId: branchRow.id,
            branch_id: branchRow.branch_id || "",
            branch_name: branchRow.storeName || branchRow.branch_name || "",
          }
        : {};
    return {
      productId: selectedTemplateByProduct.id,
      productName:
        selectedTemplateByProduct.name ||
        selectedTemplateByProduct.item_name ||
        "",
      productSku:
        selectedTemplateByProduct.sku ||
        selectedTemplateByProduct.item_code ||
        "",
      item_code:
        selectedTemplateByProduct.item_code ||
        selectedTemplateByProduct.sku ||
        "",
      units: Number.isFinite(units) && units > 0 ? units : 1,
      unit_cost: unitCost >= 0 ? unitCost : 0,
      ...branchPayload,
      items: templateByProductItems.map(mapTemplateByProductItemToPayload),
    };
  };

  const handleAddTemplateByProductRawMaterial = () => {
    if (!selectedTemplateByProduct) {
      toast.error("Select a template by-product first");
      return;
    }
    const newItem = enrichTemplateByProductItem({
      id: Date.now(),
      type: "raw_material",
      description: "",
      quantity: 0,
      raw_material_id: "",
      raw_material_sku: "",
      rate: "",
    });
    setTemplateByProductItems((prev) => [...prev, newItem]);
  };

  const handleTemplateByProductQtyChange = useCallback(
    (value) => {
      setTemplateByProductQty(value);
      // Do not auto-fill actualQty — user must enter actual quantities manually
    },
    [selectedTemplateByProduct],
  );

  const handleRemoveTemplateByProductItem = (itemId) => {
    setTemplateByProductItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleTemplateByProductItemChange = (itemId, field, value) => {
    setTemplateByProductItems((prev) =>
      prev.map((ing) => {
        if (ing.id !== itemId) return ing;
        const updated = { ...ing, [field]: value };
        if (field === "product" && value) {
          updated.description =
            value.item_name || value.name || updated.description;
          updated.raw_material_sku = value.item_code || value.sku || "";
          updated.raw_material_id = value.product_id || value.id || "";
          updated.availableQty = getRmAvailableQty(value);
          updated.isOutOfWipStock = false;
          updated.unitOfMeasure = value.unit_of_measure || "";
          const unitCost =
            value.unit_cost ?? value.cost_price ?? updated.rate ?? "";
          if (unitCost !== "" && unitCost != null) {
            updated.rate = String(unitCost);
          }
          if (!updated.quantity || Number(updated.quantity) <= 0) {
            updated.quantity = 1;
          }
          updated.actualQty = "0";
        } else if (field === "product" && !value) {
          updated.availableQty = 0;
          updated.isOutOfWipStock = true;
        }
        if (field === "quantity") {
          const availableQty = Number(ing.availableQty || 0);
          const sanitized = applyDecimalQtyBounds(value, {
            min: 0,
            max: availableQty > 0 ? availableQty : null,
          });
          const enteredQty = parseFloat(sanitized);
          if (
            sanitized !== "" &&
            !sanitized.endsWith(".") &&
            Number.isFinite(enteredQty) &&
            availableQty > 0 &&
            enteredQty > availableQty
          ) {
            toast.error(
              `Quantity cannot exceed available balance of ${availableQty}`,
            );
          } else if (
            sanitized !== "" &&
            !sanitized.endsWith(".") &&
            Number.isFinite(enteredQty) &&
            enteredQty < 0
          ) {
            toast.error("Quantity cannot be negative");
          }
          updated.quantity = sanitized;
          // Do not auto-fill actualQty when recipe qty changes — user enters manually
        }
        if (field === "actualQty") {
          const availableQty = Number(ing.availableQty || 0);
          const sanitized = applyDecimalQtyBounds(value, {
            min: 0,
            max: availableQty > 0 ? availableQty : null,
          });
          const enteredQty = parseFloat(sanitized);
          if (
            sanitized !== "" &&
            !sanitized.endsWith(".") &&
            Number.isFinite(enteredQty) &&
            availableQty > 0 &&
            enteredQty > availableQty
          ) {
            toast.error(
              `Actual qty cannot exceed available balance of ${availableQty}`,
            );
          }
          updated.actualQty = sanitized === "" ? "0" : sanitized;
        }
        if (field === "rate") {
          const withoutCommas = String(value || "").replace(/,/g, "");
          const sanitized = withoutCommas.replace(/[^0-9.]/g, "");
          const parts = sanitized.split(".");
          updated.rate =
            parts.length > 2
              ? `${parts[0]}.${parts.slice(1).join("")}`
              : sanitized;
        }
        return updated;
      }),
    );
  };

  const isIngredientType = (type) =>
    type === "raw_material" || type === "semi_finished" || !type;

  const getIngredientTypeFromProduct = (product) => {
    const itemType = String(product?.item_type || "")
      .trim()
      .toLowerCase();
    return itemType === "semi finished" ? "semi_finished" : "raw_material";
  };

  /** Normal waste: raw materials scale with good qty only; abnormal/recyclable include waste qty. */
  const normalizeProductionWasteType = (fg) => {
    const t = String(fg?.wasteType ?? fg?.waste_type ?? "")
      .trim()
      .toLowerCase();
    if (t === "abnorm" || t === "abnormal") return "abnormal";
    if (t === "recycled" || t === "recycle" || t === "recyclable") {
      return "recyclable";
    }
    return "normal";
  };

  const getIngredientOutputQtyForFinishedGood = (fg) => {
    const good = parseFloat(fg?.goodQuantity ?? fg?.quantity ?? 0) || 0;
    const waste = parseFloat(fg?.wasteQuantity ?? 0) || 0;
    const wasteType = normalizeProductionWasteType(fg);
    if (wasteType === "abnormal" || wasteType === "recyclable") {
      return good + waste;
    }
    return good;
  };

  const getTotalIngredientOutputQty = (finishedGoodsList) =>
    (finishedGoodsList || []).reduce(
      (sum, fg) => sum + getIngredientOutputQtyForFinishedGood(fg),
      0,
    );

  const getIngredientExpectedQty = (finishedGoodsList, recipeQtyPerUnit) => {
    const recipe = parseFloat(recipeQtyPerUnit || 0);
    if (!recipe) return 0;
    return Number(
      (getTotalIngredientOutputQty(finishedGoodsList) * recipe).toFixed(6),
    );
  };

  const syncIngredientsToOutputQty = (ingredients, finishedGoods) =>
    (ingredients || []).map((ing) => {
      if (!isIngredientType(ing.type || "raw_material")) return ing;
      // Keep actualQty as-is; only update expectedQuantity for display reference
      const recipeQty = parseFloat(ing.quantity || 0);
      const expected = recipeQty ? getIngredientExpectedQty(finishedGoods, recipeQty) : 0;
      return {
        ...ing,
        expectedQuantity: expected,
        // actualQty stays at whatever the user entered (or "0" if untouched)
        actualQty: ing.actualQty != null && String(ing.actualQty).trim() !== ""
          ? ing.actualQty
          : "0",
      };
    });

  // Handle changes to shared costs items (raw materials)
  const handleSharedCostChange = (index, field, value) => {
    setSharedCostsFromGroup((prev) =>
      prev.map((cost, i) => {
        if (i === index) {
          const updatedCost = { ...cost, [field]: value };
          // If product is changed, update relevant IDs and name
          if (field === "product" && value) {
            updatedCost.rawMaterialId = value.product_id || value.id || "";
            updatedCost.rawMaterialSku = value.item_code || value.sku || "";
            updatedCost.description = value.item_name || value.name || "";
            updatedCost.unitOfMeasure = value.unit_of_measure || "";
            updatedCost.unit_cost = value.unit_cost || value.cost_price || "";
          } else if (field === "product" && !value) {
            // Clear product related fields if product is deselected
            updatedCost.rawMaterialId = "";
            updatedCost.rawMaterialSku = "";
            updatedCost.description = "";
            updatedCost.unitOfMeasure = "";
            updatedCost.unit_cost = "";
          }
          return updatedCost;
        }
        return cost;
      }),
    );
  };

  // Handle updating shared cost (for all types)
  const handleUpdateSharedCost = (costId, field, value) => {
    setSharedCostsFromGroup((prev) =>
      prev.map((cost) => {
        if (cost.id === costId) {
          const updated = { ...cost, [field]: value };

          // Handle account selection for other/by_product types
          if (field === "account" && value) {
            updated.descriptionCode = value.code || "";
            updated.account_head = value.name || "";
            updated.description = value.name || updated.description || "";
          } else if (field === "account" && !value) {
            updated.descriptionCode = "";
            updated.account_head = "";
            if (updated.type !== "raw_material") {
              updated.description = "";
            }
          }

          // Handle product selection for raw_material type
          if (field === "product" && value) {
            updated.rawMaterialId = value.product_id || value.id || "";
            updated.rawMaterialSku = value.item_code || value.sku || "";
            updated.description = value.item_name || value.name || "";
            updated.unitOfMeasure = value.unit_of_measure || "";
            updated.product = value;
            // Manual selection: use product's valuation (WIP API returns correct unit_cost per default_valuation_source)
            updated.unit_cost = getSharedCostUnitCost(null, value);
          } else if (field === "product" && !value) {
            updated.rawMaterialId = "";
            updated.rawMaterialSku = "";
            updated.description = "";
            updated.unitOfMeasure = "";
            updated.unit_cost = "";
          }

          if (field === "quantity") {
            updated.expectedQuantity = value;
            // Recipe qty only — do not overwrite actual qty the user entered.
          }

          if (field === "actualQty") {
            updated.isActualQtyManuallySet = true;
            const product = updated.product || cost.product;
            const availableQty = product
              ? parseFloat(
                  product.balance ||
                    product.quantity ||
                    product.qty ||
                    product.available_qty ||
                    0,
                )
              : 0;
            const sanitized = applyDecimalQtyBounds(value, {
              min: 0,
              max: availableQty > 0 ? availableQty : null,
            });
            const entered = parseFloat(sanitized);
            if (
              sanitized !== "" &&
              !sanitized.endsWith(".") &&
              Number.isFinite(entered) &&
              availableQty > 0 &&
              entered > availableQty
            ) {
              toast.error(
                `Actual qty cannot exceed available balance (${availableQty.toFixed(4)})`,
              );
            }
            updated.actualQty = sanitized;
          }

          return updated;
        }
        return cost;
      }),
    );
  };

  // Add shared cost line
  const handleAddSharedCost = (costType = "raw_material") => {
    // Always create raw_material type for production manager interface
    const newCost = {
      id: Date.now(),
      type: "raw_material", // Force raw_material type only
      product: null,
      description: "",
      descriptionCode: "",
      account_code: "",
      quantity: "",
      expectedQuantity: "",
      actualQty: "",
      isActualQtyManuallySet: true,
      unit_cost: "",
      rate: "",
      other_type: "rate",
      percentage_basis: "raw_material",
    };
    setSharedCostsFromGroup([...sharedCostsFromGroup, newCost]);
  };

  // Remove shared cost line
  const handleRemoveSharedCost = (costId) => {
    setSharedCostsFromGroup(
      sharedCostsFromGroup.filter((cost) => cost.id !== costId),
    );
  };

  // Fetch expense list for account selection
  useEffect(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/expense-list?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setExpenseList(resp.data || []);
        }
      },
      (err) => {
        console.error("Error fetching expense list:", err);
      },
    );
  }, [activeBusiness?.id]);

  // Default abnormal loss / scrap accounts (same as Markup costing)
  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/production-default-accounts?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res?.success) {
          setProductionDefaultAccounts(res);
        }
      },
      (err) => {
        console.error("Error fetching production default accounts:", err);
      },
    );
  }, [activeBusiness?.id]);

  const getResolvedPostingAccountDisplay = useMemo(() => {
    return (fieldName, fallbackDescription) => {
      const direct = activeBusiness?.[fieldName];
      if (direct != null && String(direct).trim() !== "") {
        const code = String(direct).trim();
        let description = null;
        if (
          fieldName === "abnormal_loss_account" &&
          productionDefaultAccounts?.abnormalLossAccount?.code != null &&
          String(productionDefaultAccounts.abnormalLossAccount.code).trim() ===
            code
        ) {
          description =
            productionDefaultAccounts.abnormalLossAccount.description || null;
        }
        if (!description) {
          const ex = (expenseList || []).find(
            (e) => String(e.code || "").trim() === code,
          );
          description = ex?.name || null;
        }
        return { code, description };
      }
      if (
        fieldName === "abnormal_loss_account" &&
        productionDefaultAccounts?.abnormalLossAccount?.code
      ) {
        const a = productionDefaultAccounts.abnormalLossAccount;
        return {
          code: String(a.code).trim(),
          description: a.description || null,
        };
      }
      const match = (expenseList || []).find(
        (e) =>
          String(e.name || "")
            .trim()
            .toLowerCase() === fallbackDescription.toLowerCase(),
      );
      if (match?.code) {
        return {
          code: String(match.code).trim(),
          description: match.name || null,
        };
      }
      return { code: "", description: null };
    };
  }, [activeBusiness, productionDefaultAccounts, expenseList]);

  const resolveDefaultAbnormalLossSelection = useCallback(() => {
    const { code: resolvedAbnormalCode } = getResolvedPostingAccountDisplay(
      "abnormal_loss_account",
      "Abnormal Loss",
    );
    if (!resolvedAbnormalCode || !expenseList?.length) return [];
    const m = expenseList.find(
      (e) =>
        String(e.code || "").trim() === String(resolvedAbnormalCode).trim(),
    );
    return m ? [m] : [];
  }, [getResolvedPostingAccountDisplay, expenseList]);

  /** Seed default abnormal loss COA on operator rows missing a selection. */
  useEffect(() => {
    if (!expenseList?.length) return;
    const defaultSel = resolveDefaultAbnormalLossSelection();
    if (!defaultSel.length) return;

    setProductionItems((prev) => {
      let changed = false;
      const next = prev.map((item) => ({
        ...item,
        finishedGoods: (item.finishedGoods || []).map((fg) => {
          const entries = Array.isArray(fg.operatorEntries)
            ? fg.operatorEntries
            : [];
          let entriesChanged = false;
          const nextEntries = entries.map((entry) => {
            const wt = String(entry.wasteType || "")
              .trim()
              .toLowerCase();
            const hasWaste = (parseFloat(entry.wasteQuantity) || 0) > 0;
            if (
              hasWaste &&
              wt === "abnormal" &&
              !(entry.wasteAbnormalLossExpenseSelection?.length > 0)
            ) {
              entriesChanged = true;
              changed = true;
              return {
                ...entry,
                wasteAbnormalLossExpenseSelection: defaultSel,
              };
            }
            return entry;
          });
          if (!entriesChanged) return fg;
          return applyOperatorEntryTotals(
            { ...fg, operatorEntries: nextEntries },
            null,
          );
        }),
      }));
      return changed ? next : prev;
    });
  }, [
    expenseList,
    productionDefaultAccounts?.abnormalLossAccount?.code,
    activeBusiness?.abnormal_loss_account,
    resolveDefaultAbnormalLossSelection,
  ]);

  const [costingTemplates, setCostingTemplates] = useState([]);

  // Add a new shared raw material
  const addSharedCostRawMaterial = () => {
    if (!newSharedRawMaterial.product || !newSharedRawMaterial.quantity) {
      toast.error("Please select a raw material and provide a quantity");
      return;
    }

    const product = newSharedRawMaterial.product;
    const newRawMaterialCost = {
      id: Date.now(),
      type: "raw_material",
      description: product.item_name,
      quantity: parseFloat(newSharedRawMaterial.quantity),
      rawMaterialId: product.product_id || product.id,
      rawMaterialSku: product.item_code || product.sku,
      unitOfMeasure: product.unit_of_measure,
      product,
      unit_cost: getSharedCostUnitCost(null, product),
    };

    setSharedCostsFromGroup((prev) => [...prev, newRawMaterialCost]);
    setNewSharedRawMaterial({ product: null, quantity: "" }); // Reset new item form
    toast.success("Raw material added to shared costs");
  };

  const [loading, setLoading] = useState(false);
  const [expandedItem, setExpandedItem] = useState(null);

  // Multiplier modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [multiplierForm, setMultiplierForm] = useState({
    multiplier_type: "",
    multiplier_value: "",
    product_id: "",
    product_name: "",
    sku: "",
    status: "active",
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [creatingMultiplierContext, setCreatingMultiplierContext] =
    useState(null); // { finishedGood, productionItemId }

  const fetchFinishedGoodProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _postApi(
      `/inventory/product-list-1?query_type=select`,
      {
        facilityId: activeBusiness.id,
        type: "Finished Good",
      },
      (resp) => {
        if (resp.success) {
          setFinishedGoodProducts(resp.results || []);
        } else {
          toast.error("Failed to load finished goods");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Error fetching finished goods");
      },
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/inventory/wip?facilityId=${activeBusiness.id}`,
      (resp) => {
        // console.log("WIP Inventory Data:", resp.data);
        if (resp.success) {
          setRawMaterialProducts(resp.data.wipItems || []);
        } else {
          toast.error("Failed to load WIP inventory data");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching WIP inventory data");
        setLoading(false);
      },
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list-1?query_type=select`,
      {
        facilityId: activeBusiness.id,
        type: "Raw Material",
      },
      (resp) => {
        if (resp.success) {
          setRawMaterialCatalog(resp.results || []);
        }
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  // WIP stock + full raw material catalog for shared-cost dropdowns and matching.
  const sharedRawMaterialSelectOptions = useMemo(() => {
    const byCode = new Map();
    const add = (product) => {
      const code = String(
        product?.item_code || product?.sku || product?.product_id || "",
      ).trim();
      if (!code) return;
      const existing = byCode.get(code);
      if (!existing || getRmAvailableQty(product) > getRmAvailableQty(existing)) {
        byCode.set(code, product);
      }
    };

    rawMaterialCatalog.forEach((p) =>
      add({
        id: p.id,
        product_id: p.sku || p.id,
        item_code: p.sku || p.item_code || "",
        sku: p.sku || p.item_code || "",
        item_name: p.item_name || p.name || "",
        name: p.name || p.item_name || "",
        unit_of_measure: p.unit_of_measure || "",
        balance: 0,
        qty: 0,
        unit_cost: p.cost_price,
        cost_price: p.cost_price,
        item_type: p.item_type || "Raw Material",
      }),
    );
    rawMaterialProducts.forEach(add);
    return Array.from(byCode.values());
  }, [rawMaterialCatalog, rawMaterialProducts]);

  // Fetch costing templates for job-specific production/template-driven costing
  useEffect(() => {
    if (!activeBusiness?.id) return;
    const shouldLoadCostingTemplates =
      costingType === "job_specific" ||
      activeBusiness?.costing_method === "job_product_costing";
    if (!shouldLoadCostingTemplates) return;

    _fetchApi(
      `/api/costing-templates?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setCostingTemplates(resp.data || []);
        } else {
          console.error("Failed to load costing templates");
        }
      },
      (err) => {
        console.error("API Error fetching costing templates:", err);
      },
    );
  }, [activeBusiness?.id, activeBusiness?.costing_method, costingType]);

  // Fetch product groups for joint_shared costing
  useEffect(() => {
    if (!activeBusiness?.id || costingType !== "joint_shared") return;

    _fetchApi(
      `/api/product-groups?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          const groups = resp.data || [];
          setProductGroups(groups);
        } else {
          console.error("Failed to load product groups");
        }
      },
      (err) => {
        console.error("Error fetching product groups:", err);
      },
    );
  }, [activeBusiness?.id, costingType]);

  // Fetch operators from Team model
  useEffect(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/api/get/team?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          const teams = resp.results || [];
          const activeTeams = teams.filter((team) => team.status === "active");
          setOperatorTeams(activeTeams);
        }
      },
      (err) => {
        console.error("Error fetching operators:", err);
      },
    );
  }, [activeBusiness?.id]);

  const fetchProductsWithMultipliers = useCallback(
    (sku) => {
      if (!activeBusiness?.id) return;

      _fetchApi(
        `/inventory/products-with-multipliers?facilityId=${activeBusiness.id}&sku=${sku}`,
        (resp) => {
          if (resp.success) {
            setAllMultipliers(resp.data);
          } else {
            toast.error("Failed to load products with multipliers");
          }
        },
        (err) => {
          console.error("API Error:", err);
          toast.error("Error fetching products with multipliers");
        },
      );
    },
    [activeBusiness.id],
  );

  // Helper: compute unit_cost for raw material based on default_valuation_source
  // default_cost: use template rate as unit price; system_valuation: use WIP valuation (unit_cost from API)
  const getSharedCostUnitCost = (templateRate, foundProduct) => {
    const useDefaultCost =
      activeBusiness?.default_valuation_source === "default_cost";
    const rateNum = parseFloat(templateRate);
    const hasTemplateRate =
      templateRate != null &&
      templateRate !== "" &&
      !isNaN(rateNum) &&
      rateNum >= 0;

    if (useDefaultCost && hasTemplateRate) return rateNum;
    if (foundProduct)
      return parseFloat(foundProduct.unit_cost || foundProduct.cost_price || 0);
    return hasTemplateRate ? rateNum : 0;
  };

  const enrichSharedCostItem = (cost) => {
    const mapped = mapTemplateByProductItem(cost);
    const { product, matchedInWip } = resolveRawMaterialProductFromList(
      mapped,
      sharedRawMaterialSelectOptions,
      cost.product,
      rawMaterialCatalog,
    );
    return {
      ...cost,
      type: cost.type || mapped.type || "raw_material",
      description:
        cost.description ||
        mapped.description ||
        product?.item_name ||
        product?.name ||
        "",
      rawMaterialSku:
        mapped.raw_material_sku ||
        cost.rawMaterialSku ||
        product?.item_code ||
        product?.sku ||
        "",
      rawMaterialId:
        mapped.raw_material_id ||
        cost.rawMaterialId ||
        product?.product_id ||
        product?.id ||
        "",
      rawMaterialName:
        mapped.raw_material_name ||
        cost.rawMaterialName ||
        product?.item_name ||
        product?.name ||
        "",
      product: product || cost.product || null,
      unit_cost:
        cost.unit_cost ||
        getSharedCostUnitCost(
          cost.rate ?? cost.rate_amount,
          product || cost.product,
        ),
      isOutOfWipStock: Boolean(product && !matchedInWip),
    };
  };

  const getSharedCostRecipeQty = (cost) =>
    parseFloat(cost?.expectedQuantity ?? cost?.quantity ?? 0) || 0;

  /** Suggested total from template × batch scale (reference only). */
  const getSharedCostExpectedTotal = (cost) =>
    parseFloat(sharedCostQtyUse || 1) * getSharedCostRecipeQty(cost);

  const computeSharedCostActualQty = (cost, multiplier = sharedCostQtyUse) => {
    const recipe = getSharedCostRecipeQty(cost);
    return String((parseFloat(multiplier || 1) * recipe).toFixed(4));
  };

  const getSharedCostActualTotal = (cost) => {
    if (cost?.actualQty != null && String(cost.actualQty).trim() !== "") {
      return parseFloat(cost.actualQty) || 0;
    }
    return getSharedCostRecipeQty(cost);
  };

  const applyDefaultActualQtyToSharedCosts = (costs, multiplier) =>
    (costs || []).map((cost) => {
      if (!isIngredientType(cost.type)) return cost;
      return {
        ...cost,
        expectedQuantity: cost.expectedQuantity ?? cost.quantity,
        // Never auto-fill actual qty — user must enter it manually
        actualQty: cost.isActualQtyManuallySet
          ? cost.actualQty
          : (cost.actualQty != null && String(cost.actualQty).trim() !== "" && cost.actualQty !== "0"
              ? cost.actualQty
              : "0"),
        isActualQtyManuallySet: cost.isActualQtyManuallySet ?? false,
      };
    });

  const initializeSharedCostActualQty = (costs) =>
    (costs || []).map((cost) => {
      if (!isIngredientType(cost.type)) {
        return { ...cost, isActualQtyManuallySet: false };
      }
      const existingActual =
        cost.actualQty != null && String(cost.actualQty).trim() !== ""
          ? String(cost.actualQty)
          : "0";
      return {
        ...cost,
        expectedQuantity: cost.expectedQuantity ?? cost.quantity,
        actualQty: existingActual,
        isActualQtyManuallySet: false,
      };
    });

  // Parse shared costs from product group notes
  const parseSharedCostsFromNotes = (notes) => {
    if (!notes) return [];

    let sharedCosts = [];
    let costingData = null;

    // Try to parse JSON first - new format (notes is directly JSON)
    try {
      // First, try parsing notes directly as JSON (new format)
      let notesToParse = notes;

      // Check if it's a JSON-encoded string (escaped JSON)
      if (
        typeof notesToParse === "string" &&
        notesToParse.trim().startsWith('"')
      ) {
        try {
          // Parse the escaped JSON string first
          notesToParse = JSON.parse(notesToParse);
        } catch (e) {
          // If that fails, use original string
        }
      }

      costingData = JSON.parse(notesToParse);

      // Check for new format: sharedCost (singular)
      if (costingData.sharedCost && Array.isArray(costingData.sharedCost)) {
        sharedCosts = costingData.sharedCost.map((item, index) => {
          const costItem = {
            id: Date.now() + index,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            expectedQuantity: item.quantity,
            actualQty: "",
            isActualQtyManuallySet: false,
            rate: item.rate,
            other_type: item.otherType || "rate",
            percentage_basis: item.percentageBasis || "raw_material",
            descriptionCode: item.descriptionCode,
            account_head: item.accountHead,
            rawMaterialId: item.rawMaterialId,
            rawMaterialName: item.rawMaterialName,
            rawMaterialSku: item.rawMaterialSku,
            product: null,
          };

          // If it's a raw material, find and set the product
          // Use SKU only for matching - use item_code which is the SKU field
          if (isIngredientType(costItem.type) && costItem.rawMaterialSku) {
            const foundProduct = rawMaterialProducts.find(
              (rm) => String(rm.item_code) === String(costItem.rawMaterialSku),
            );
            if (foundProduct) costItem.product = foundProduct;
            costItem.unit_cost = getSharedCostUnitCost(
              item.rate ?? item.rate_amount,
              foundProduct || undefined,
            );
          }

          return costItem;
        });
      }
      // Check for old format: sharedCosts (plural) - backward compatibility
      else if (
        costingData.sharedCosts &&
        Array.isArray(costingData.sharedCosts)
      ) {
        sharedCosts = costingData.sharedCosts.map((item, index) => {
          const costItem = {
            id: Date.now() + index,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            expectedQuantity: item.quantity,
            actualQty: "",
            isActualQtyManuallySet: false,
            rate: item.rate,
            other_type: item.otherType || "rate",
            percentage_basis: item.percentageBasis || "raw_material",
            descriptionCode: item.descriptionCode,
            account_head: item.accountHead,
            rawMaterialId: item.rawMaterialId,
            rawMaterialName: item.rawMaterialName,
            rawMaterialSku: item.rawMaterialSku,
            product: null,
          };

          // If it's a raw material, find and set the product
          // Use SKU only for matching - use item_code which is the SKU field
          if (isIngredientType(costItem.type) && costItem.rawMaterialSku) {
            const foundProduct = rawMaterialProducts.find(
              (rm) => String(rm.item_code) === String(costItem.rawMaterialSku),
            );
            if (foundProduct) costItem.product = foundProduct;
            costItem.unit_cost = getSharedCostUnitCost(
              item.rate ?? item.rate_amount,
              foundProduct || undefined,
            );
          }

          return costItem;
        });
      }
    } catch (e) {
      // If direct JSON parsing fails, try old format with "--- JSON DATA ---" marker
      try {
        const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
        if (jsonMatch) {
          costingData = JSON.parse(jsonMatch[1]);
          // Check for sharedCost (new format) or sharedCosts (old format)
          const sharedCostArray =
            costingData.sharedCost || costingData.sharedCosts;
          if (sharedCostArray && Array.isArray(sharedCostArray)) {
            sharedCosts = sharedCostArray.map((item, index) => {
              const costItem = {
                id: Date.now() + index,
                type: item.type,
                description: item.description,
                quantity: item.quantity,
                expectedQuantity: item.quantity,
                actualQty: "",
                isActualQtyManuallySet: false,
                rate: item.rate,
                other_type: item.otherType || "rate",
                percentage_basis: item.percentageBasis || "raw_material",
                descriptionCode: item.descriptionCode,
                account_head: item.accountHead,
                rawMaterialId: item.rawMaterialId,
                rawMaterialName: item.rawMaterialName,
                rawMaterialSku: item.rawMaterialSku,
                product: null,
              };

              // If it's a raw material, find and set the product
              if (
                isIngredientType(costItem.type) &&
                (costItem.rawMaterialSku || costItem.rawMaterialId)
              ) {
                const foundProduct = rawMaterialProducts.find(
                  (rm) =>
                    String(rm.product_id) === String(costItem.rawMaterialId) ||
                    String(rm.item_code) === String(costItem.rawMaterialSku) ||
                    String(rm.item_code) === String(costItem.rawMaterialId) ||
                    rm.item_name === costItem.rawMaterialName ||
                    rm.item_name === costItem.description,
                );
                if (foundProduct) costItem.product = foundProduct;
                costItem.unit_cost = getSharedCostUnitCost(
                  item.rate ?? item.rate_amount,
                  foundProduct || undefined,
                );
              }

              return costItem;
            });
          }
        }
      } catch (e2) {
        console.warn(
          "Failed to parse JSON from notes, falling back to text parsing:",
          e2,
        );
      }
    }

    // Fallback to text parsing if JSON parsing failed
    if (!costingData || sharedCosts.length === 0) {
      const lines = notes.split("\n");
      let inSharedCosts = false;

      lines.forEach((line) => {
        if (line.includes("Shared Costs:")) {
          inSharedCosts = true;
        } else if (line.includes("Products in this shared costing:")) {
          inSharedCosts = false;
        } else if (inSharedCosts && line.trim().match(/^\d+\./)) {
          const typeMatch = line.match(/Type:\s*(\w+)/);
          const descMatch = line.match(/Description:\s*([^,]+)/);
          const qtyMatch = line.match(/Quantity:\s*([\d.]+)/);
          const rateMatch = line.match(/Rate:\s*([\d.]+)/);
          const percentageMatch = line.match(/Percentage:\s*([\d.]+)/);
          const inputTypeMatch = line.match(/InputType:\s*(\w+)/);
          const percentageBasisMatch = line.match(/PercentageBasis:\s*(\w+)/);
          const descriptionCodeMatch = line.match(
            /DescriptionCode:\s*([^,\s]+)/,
          );
          const accountHeadMatch = line.match(/AccountHead:\s*([^,]+?)(?:,|$)/);
          const rawMaterialIdMatch = line.match(/RawMaterialId:\s*([^,\s]+)/);
          const rawMaterialNameMatch = line.match(
            /RawMaterialName:\s*([^,]+?)(?:,|$)/,
          );
          const rawMaterialSkuMatch = line.match(/RawMaterialSku:\s*([^,\s]+)/);

          if (typeMatch && descMatch) {
            const costItem = {
              id: Date.now() + sharedCosts.length,
              type: typeMatch[1],
              description: descMatch[1].trim(),
              quantity: qtyMatch ? parseFloat(qtyMatch[1]) : null,
              rate: rateMatch ? parseFloat(rateMatch[1]) : null,
              percentage: percentageMatch
                ? parseFloat(percentageMatch[1])
                : null,
              other_type: inputTypeMatch ? inputTypeMatch[1] : "rate",
              percentage_basis: percentageBasisMatch
                ? percentageBasisMatch[1].trim()
                : "raw_material",
              descriptionCode: descriptionCodeMatch
                ? descriptionCodeMatch[1].trim()
                : null,
              account_head: accountHeadMatch
                ? accountHeadMatch[1].trim()
                : null,
              rawMaterialId: rawMaterialIdMatch
                ? rawMaterialIdMatch[1].trim()
                : null,
              rawMaterialName: rawMaterialNameMatch
                ? rawMaterialNameMatch[1].trim()
                : null,
              rawMaterialSku: rawMaterialSkuMatch
                ? rawMaterialSkuMatch[1].trim()
                : null,
              product: null,
            };

            // If it's a raw material, find and set the product
            if (isIngredientType(costItem.type) && costItem.rawMaterialId) {
              const foundProduct = rawMaterialProducts.find(
                (rm) =>
                  String(rm.product_id) === String(costItem.rawMaterialId) ||
                  String(rm.item_code) === String(costItem.rawMaterialSku) ||
                  String(rm.item_code) === String(costItem.rawMaterialId) ||
                  rm.item_name === costItem.rawMaterialName ||
                  rm.item_name === costItem.description,
              );
              if (foundProduct) {
                costItem.product = foundProduct;
                costItem.unit_cost =
                  foundProduct.unit_cost || foundProduct.cost_price || "";
              }
            }

            sharedCosts.push(costItem);
          }
        }
      });
    }

    return sharedCosts;
  };

  // Parse products and their specific items from notes
  const parseProductsFromNotes = (notes) => {
    if (!notes) return [];

    let products = [];
    let costingData = null;

    // Try to parse JSON first - new format (notes is directly JSON)
    try {
      // First, try parsing notes directly as JSON (new format)
      let notesToParse = notes;

      // Check if it's a JSON-encoded string (escaped JSON)
      if (
        typeof notesToParse === "string" &&
        notesToParse.trim().startsWith('"')
      ) {
        try {
          // Parse the escaped JSON string first
          notesToParse = JSON.parse(notesToParse);
        } catch (e) {
          // If that fails, use original string
        }
      }

      costingData = JSON.parse(notesToParse);

      if (costingData.products && Array.isArray(costingData.products)) {
        products = costingData.products.map((p) => ({
          name: p.productName,
          sku: p.productSku,
          units: p.units,
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
      // If direct JSON parsing fails, try old format with "--- JSON DATA ---" marker
      try {
        const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
        if (jsonMatch) {
          costingData = JSON.parse(jsonMatch[1]);
          if (costingData.products && Array.isArray(costingData.products)) {
            products = costingData.products.map((p) => ({
              name: p.productName,
              sku: p.productSku,
              units: p.units,
              items: (p.items || []).map((item) => ({
                type: item.type,
                description: item.description,
                quantity: item.quantity,
                rawMaterialId: item.rawMaterialId,
                rawMaterialSku: item.rawMaterialSku,
              })),
            }));
          }
        }
      } catch (e2) {
        console.warn(
          "Failed to parse JSON from notes, falling back to text parsing:",
          e2,
        );
      }
    }

    // Fallback to text parsing if JSON parsing failed
    if (!costingData || products.length === 0) {
      const lines = notes.split("\n");
      let inProducts = false;
      let currentProduct = null;

      lines.forEach((line) => {
        if (line.includes("Products in this shared costing:")) {
          inProducts = true;
        } else if (inProducts && line.trim().match(/^\d+\./)) {
          // Parse product line: " 1. Maize Flour 10kg (PROD-00159)"
          const productMatch = line.match(/\d+\.\s*([^(]+)\s*\(([^)]+)\)/);
          if (productMatch) {
            currentProduct = {
              name: productMatch[1].trim(),
              sku: productMatch[2].trim(),
              items: [],
            };
            products.push(currentProduct);
          }
        } else if (inProducts && line.trim() === "Product Specific Items:") {
          // Keep currentProduct active for next items
        } else if (
          inProducts &&
          line.match(/^\s+\d+\.\s*Type:/) &&
          currentProduct
        ) {
          // Parse product item line
          const typeMatch = line.match(/Type:\s*(\w+)/);
          const descMatch = line.match(/Description:\s*([^,]+)/);
          const qtyMatch = line.match(/Quantity:\s*([\d.]+)/);
          const rmIdMatch = line.match(/RawMaterialId:\s*([^,]+)/);
          const rmSkuMatch = line.match(/RawMaterialSku:\s*([^,\s]+)/);

          if (typeMatch && descMatch) {
            const item = {
              type: typeMatch[1],
              description: descMatch[1].trim(),
              quantity: qtyMatch ? parseFloat(qtyMatch[1]) : 1,
              rawMaterialId: rmIdMatch ? rmIdMatch[1].trim() : null,
              rawMaterialSku: rmSkuMatch ? rmSkuMatch[1].trim() : null,
            };
            currentProduct.items.push(item);
          }
        }
      });
    }

    return products;
  };

  // Helper function to load ingredients from product notes
  const loadIngredientsFromProductNotes = (
    productNotes,
    productionItemId,
    productName,
    itemIndex,
  ) => {
    if (!productNotes || !productNotes.includes("Costing Template Items:")) {
      console.log(`[${productName}] No Costing Template Items found in notes`);
      return;
    }

    const notesItems = parseProductNotesItems(productNotes);
    if (notesItems.length === 0) {
      console.log(
        `[${productName}] No raw material items found in product notes`,
      );
      return;
    }

    console.log(
      `[${productName}] Found ${notesItems.length} items in product notes, adding to ingredients`,
    );

    // Create ingredient objects from notes items
    const newIngredientsFromNotes = notesItems.map((notesItem, itemIdx) => {
      // Use SKU only for matching - use item_code which is the SKU field
      const actualRawMaterial = rawMaterialProducts.find((rm) => {
        if (notesItem.rawMaterialSku) {
          return String(rm.item_code) === String(notesItem.rawMaterialSku);
        }
        return false;
      });

      return {
        id: Date.now() + itemIndex * 10000 + itemIdx + 10000,
        type: notesItem.type || "raw_material", // Preserve type from notes
        product: actualRawMaterial || {
          id: notesItem.rawMaterialId || notesItem.rawMaterialSku,
          product_id: notesItem.rawMaterialId || notesItem.rawMaterialSku,
          item_code: notesItem.rawMaterialSku || notesItem.rawMaterialId,
          item_name: notesItem.rawMaterialName || notesItem.description,
          unit_of_measure: "",
          balance: 0,
          stock_quantity: 0,
          qty: 0,
        },
        quantity: String(notesItem.quantity || "1"),
        unitOfMeasure: "",
        availableQty: 0,
        isSharedCost: false,
      };
    });

    // Add these to ingredients, avoiding duplicates
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          // Check for duplicates based on item_code, product_id, or id
          const existingIds = new Set(
            item.ingredients.map((ing) => {
              const id =
                ing.product?.item_code ||
                ing.product?.product_id ||
                ing.product?.id;
              return String(id).toLowerCase();
            }),
          );

          const uniqueNew = newIngredientsFromNotes.filter((ing) => {
            const id =
              ing.product?.item_code ||
              ing.product?.product_id ||
              ing.product?.id;
            return !existingIds.has(String(id).toLowerCase());
          });

          if (uniqueNew.length > 0) {
            console.log(
              `[${productName}] Adding ${uniqueNew.length} unique ingredients from product notes`,
            );
            return {
              ...item,
              ingredients: [...item.ingredients, ...uniqueNew],
            };
          }
        }
        return item;
      }),
    );
  };

  // Handle product group selection
  const handleProductGroupChange = (groupId) => {
    const selectedGroup = productGroups.find((g) => g.id === parseInt(groupId));
    setSelectedProductGroup(selectedGroup);
    setSelectedActualProductGroup(selectedGroup || null);

    // Clear existing production items and shared costs when selecting a new template
    // This ensures old data doesn't persist when loading a new template
    // Clear state BEFORE loading new template to prevent stale data
    setProductionItems([]);
    setSharedCostsFromGroup([]);
    setSharedCostQtyUse(1);
    setSharedCostOutputPercentage(1);
    setSharedJointWasteType("normal");
    setSharedJointScrapByProductSelection([]);
    setSharedJointScrapCost("");
    setSharedJointScrapQty("");
    clearTemplateByProductState();

    if (!selectedGroup) {
      return;
    }

    if (selectedGroup && selectedGroup.notes) {
      // Parse JSON directly from notes (new format)
      // The notes field contains a JSON string that may have escaped characters
      let costingData = null;
      let notesString = selectedGroup.notes;

      // Try to parse the notes as JSON
      // The notes may be a JSON-encoded string (escaped), so we may need to parse twice
      try {
        // First attempt: parse directly
        let parsed = JSON.parse(notesString);

        // If the result is a string, it means the JSON was encoded (escaped)
        // Parse it again to get the actual object
        if (typeof parsed === "string") {
          console.log("First parse returned a string, parsing again...");
          costingData = JSON.parse(parsed);
        } else if (typeof parsed === "object" && parsed !== null) {
          // It's already an object, use it directly
          costingData = parsed;
        } else {
          // Fallback: try parsing the original string again
          costingData = parsed;
        }

        console.log("Successfully parsed JSON from notes:", costingData);
        console.log("costingData type:", typeof costingData);
        console.log("costingData.products exists?", !!costingData?.products);
        console.log(
          "costingData.products is array?",
          Array.isArray(costingData?.products),
        );
        console.log(
          "costingData.products length:",
          costingData?.products?.length,
        );
        console.log(
          "Full costingData keys:",
          costingData
            ? Object.keys(costingData)
            : "costingData is null/undefined",
        );

        // Force use costingData.products if it exists in the JSON
        if (
          costingData &&
          typeof costingData === "object" &&
          "products" in costingData
        ) {
          console.log(
            "✓ costingData.products field exists in object, value:",
            costingData.products,
          );
        } else {
          console.warn("✗ costingData.products field does NOT exist in object");
        }
      } catch (e) {
        // If direct parse fails, try to handle escaped JSON strings
        try {
          // Check if it's a string containing escaped JSON (like "{\n  \"sharedCost\": ...")
          // In this case, we might need to parse it twice
          if (
            typeof notesString === "string" &&
            notesString.trim().startsWith('"')
          ) {
            // It's a JSON-encoded string, parse it first to get the actual JSON string
            const decodedString = JSON.parse(notesString);
            costingData = JSON.parse(decodedString);
            console.log(
              "Successfully parsed escaped JSON from notes:",
              costingData,
            );
          } else {
            // Try parsing as-is
            costingData = JSON.parse(notesString);
          }
        } catch (e2) {
          // Fallback to old format with "--- JSON DATA ---" marker
          try {
            const jsonMatch = notesString?.match(
              /--- JSON DATA ---\n([\s\S]*)$/,
            );
            if (jsonMatch) {
              costingData = JSON.parse(jsonMatch[1]);
              console.log("Parsed JSON from old format marker:", costingData);
            }
          } catch (e3) {
            console.warn("Failed to parse JSON from notes:", e3);
            console.warn("Notes content:", notesString?.substring(0, 200));
          }
        }
      }

      // Parse shared costs from the parsed JSON data
      let parsedSharedCosts = [];
      // Check for both sharedCost (singular) and sharedCosts (plural) for backward compatibility
      const sharedCostArray =
        costingData?.sharedCost || costingData?.sharedCosts;
      if (sharedCostArray && Array.isArray(sharedCostArray)) {
        // Use the parsed JSON data directly
        parsedSharedCosts = sharedCostArray.map((item, index) => {
          const costItem = {
            id: Date.now() + index,
            type: item.type,
            description: item.description,
            quantity: item.quantity || 0,
            expectedQuantity: item.quantity || 0,
            rate: item.rate || "",
            other_type: item.otherType || item.other_type || "rate",
            percentage_basis: item.percentageBasis || item.percentage_basis || "raw_material",
            descriptionCode: item.descriptionCode || item.description_code || "",
            account_head: item.accountHead || item.account_head || "",
            rawMaterialId: item.rawMaterialId || item.raw_material_id || "",
            rawMaterialName: item.rawMaterialName || item.raw_material_name || "",
            rawMaterialSku: item.rawMaterialSku || item.raw_material_sku || "",
            product: null,
          };
          return enrichSharedCostItem(costItem);
        });
      } else {
        // Fallback to parseSharedCostsFromNotes function
        parsedSharedCosts = parseSharedCostsFromNotes(selectedGroup.notes);
      }

      console.log("Parsed shared costs:", parsedSharedCosts);

      setSharedCostsFromGroup(
        initializeSharedCostActualQty(
          parsedSharedCosts.map((cost) =>
            isIngredientType(cost.type) ? enrichSharedCostItem(cost) : cost,
          ),
        ),
      );

      // Extract and set output percentage from JSON
      if (costingData && costingData.output !== undefined) {
        const outputValue = parseFloat(costingData.output) || 1;
        setSharedCostOutputPercentage(outputValue);
        console.log("Set output percentage from JSON:", outputValue);
      }

      if (costingData) {
        applyTemplateByProductFromCostingData(costingData);
      }

      // Parse products directly from JSON - USE ONLY DATA FROM NOTES, NOT FALLBACK
      // Log costingData structure before checking
      console.log(
        "[handleProductGroupChange] Checking costingData before products check:",
        {
          costingDataExists: !!costingData,
          costingDataType: typeof costingData,
          costingDataKeys: costingData ? Object.keys(costingData) : [],
          hasProductsField: costingData && "products" in costingData,
          productsValue: costingData?.products,
          productsType: typeof costingData?.products,
          productsIsArray: Array.isArray(costingData?.products),
        },
      );

      let parsedProducts = [];
      if (
        costingData &&
        costingData.products &&
        Array.isArray(costingData.products) &&
        costingData.products.length > 0
      ) {
        // Use the parsed JSON data directly from costingData.products
        // DO NOT use fallback function - use only the data from notes
        parsedProducts = costingData.products;
        console.log(
          "Parsed products from JSON (costingData.products):",
          parsedProducts,
        );
        console.log("Products count:", parsedProducts.length);
        parsedProducts.forEach((p, idx) => {
          console.log(
            `Product ${idx + 1}: productName="${p.productName}", productSku="${
              p.productSku
            }", productId=${p.productId}, items count=${p.items?.length || 0}`,
          );
        });
      } else {
        // If no products in JSON, clear state and show warning
        console.warn(
          "No products found in costingData.products, clearing state",
        );
        setProductionItems([]);
        setSharedCostsFromGroup([]);
        setSharedCostOutputPercentage(1);
        toast.warning("No products found in the selected template");
        return; // Exit early, don't use fallback
      }

      if (parsedProducts.length > 0) {
        // Find products in finishedGoodProducts array
        const firstBranch = branchOptions[0];
        const defaultBranchFields = firstBranch
          ? {
              branchLocationId: firstBranch.id,
              branch_id: firstBranch.branch_id || "",
              branch_name:
                firstBranch.storeName || firstBranch.branch_name || "",
            }
          : {
              branchLocationId: null,
              branch_id: "",
              branch_name: "",
            };
        const newProductionItems = parsedProducts.map((product, index) => {
          // Find product in finishedGoodProducts array
          console.log(
            `[handleProductGroupChange] Looking for product: productName="${product.productName}", productSku="${product.productSku}", productId=${product.productId}`,
          );
          // console.log("finishedGoodProducts", product);
          const actualProduct = finishedGoodProducts.find(
            (p) =>
              p.sku === product.productSku ||
              p.item_code === product.productSku ||
              p.id === product.productId ||
              p.product_id === product.productId,
          );

          if (actualProduct) {
            console.log(
              `[handleProductGroupChange] Found actualProduct: item_name="${actualProduct.item_name}", sku="${actualProduct.sku}", id=${actualProduct.id}`,
            );
          } else {
            console.log(
              `[handleProductGroupChange] Product not found in finishedGoodProducts, using fallbackProduct: item_name="${product.productName}"`,
            );
          }

          // Create fallback product if not found in list
          const fallbackProduct = {
            id: product.productId || product.productSku,
            product_id: product.productId,
            item_name: product.productName, // Use productName from template JSON
            name: product.productName,
            sku: product.productSku,
            item_code: product.productSku,
            unit_of_measure: actualProduct?.unit_of_measure || "",
          };

          const finalProduct = actualProduct || fallbackProduct;
          console.log(
            `[handleProductGroupChange] Using finalProduct for ${
              product.productName
            }: item_name="${finalProduct.item_name || finalProduct.name}", id=${
              finalProduct.id || finalProduct.product_id
            }`,
          );

          // Load ingredients directly from product.items array in JSON
          // Load ALL types (raw_material, other, by_product_credit) but only display raw_material in UI
          const productItems = product.items || [];

          console.log(
            `[${product.productName}] Loading ${productItems.length} items from template:`,
            productItems.map((item) => ({
              type: item.type,
              description: item.description,
              descriptionCode:
                item.descriptionCode || item.description_code || "",
            })),
          );

          const ingredients = productItems
            .map((item, itemIndex) => {
              const itemType = item.type || "raw_material";

              // Extract descriptionCode - MUST use fields directly from JSON (item.descriptionCode)
              // Do not rely on fallback parsing
              const itemDescriptionCode =
                item.descriptionCode || item.description_code || "";
              console.log(
                `[${product.productName}] Processing item ${itemIndex + 1}/${
                  productItems.length
                }: type=${itemType}, descriptionCode="${itemDescriptionCode}", description="${
                  item.description || ""
                }"`,
              );

              // For raw_material type, handle product lookup
              if (isIngredientType(itemType)) {
                // Use SKU / id keys for matching against live WIP balances
                const actualRawMaterial = findWipProductMatch(item);

                // Log if raw material not found
                if (!actualRawMaterial && item.rawMaterialSku) {
                  console.warn(
                    `[${product.productName}] ✗ Raw material NOT FOUND in WIP: SKU="${item.rawMaterialSku}", Name="${item.rawMaterialName || item.description}". Will create fallback product.`,
                  );
                }

                // Calculate available quantity from raw material product
                const availableQty = actualRawMaterial
                  ? getRmAvailableQty(actualRawMaterial)
                  : 0;

                const rawMaterialProduct = actualRawMaterial || {
                  id: item.rawMaterialId || item.rawMaterialSku,
                  product_id: item.rawMaterialId || item.rawMaterialSku,
                  item_code: item.rawMaterialSku || item.rawMaterialId,
                  item_name: item.rawMaterialName || item.description,
                  unit_of_measure: item.rawMaterialName ? "" : "",
                  balance: 0,
                  stock_quantity: 0,
                  qty: 0,
                  unit_cost: item.unit_cost,
                  cost_price: item.unit_cost,
                };
                const templateRate =
                  item.rate ?? item.rate_amount ?? item.unit_cost;
                return {
                  id: Date.now() + index * 1000 + itemIndex + 5000,
                  type: itemType || "raw_material",
                  product: rawMaterialProduct,
                  rate: item.rate ?? item.rate_amount ?? "",
                  quantity: String(item.quantity || "1"),
                  unitOfMeasure: actualRawMaterial?.unit_of_measure || "",
                  availableQty: availableQty,
                  isOutOfWipStock: !actualRawMaterial, // Mark as out of stock if not found in WIP
                  isSharedCost: false,
                  unit_cost: getSharedCostUnitCost(
                    templateRate,
                    rawMaterialProduct,
                  ),
                };
              } else {
                // For other types (other, by_product_credit), create ingredient without product
                // Must have descriptionCode to be valid for saving
                // Use descriptionCode directly from item (from JSON) - do not rely on fallback parsing
                const descriptionCode =
                  item.descriptionCode || item.description_code || "";

                console.log(
                  `[${
                    product.productName
                  }] Processing ${itemType} item: descriptionCode="${descriptionCode}", description="${
                    item.description || ""
                  }", accountHead="${
                    item.accountHead || item.account_head || ""
                  }", rate="${item.rate || ""}", otherType="${
                    item.otherType || item.other_type || ""
                  }"`,
                );

                // Log if we're skipping an item - but this should NOT happen if JSON has descriptionCode
                if (!descriptionCode) {
                  console.warn(
                    `[${product.productName}] WARNING: Skipping ${itemType} item without descriptionCode. Item data:`,
                    JSON.stringify(item, null, 2),
                  );
                  return null;
                }

                console.log(
                  `[${
                    product.productName
                  }] Creating ${itemType} ingredient with descriptionCode="${descriptionCode}", description="${
                    item.description || ""
                  }"`,
                );

                return {
                  id: Date.now() + index * 1000 + itemIndex + 5000,
                  type: itemType, // Preserve type (other or by_product_credit)
                  product: null, // No product for other types
                  description: item.description || "",
                  descriptionCode: descriptionCode,
                  account_head: item.accountHead || item.account_head || "",
                  other_type: item.otherType || item.other_type || "rate",
                  rate: item.rate || "",
                  quantity: String(item.quantity || "0"), // For percentage-based, this is the percentage
                  percentage_basis:
                    item.percentageBasis ||
                    item.percentage_basis ||
                    "raw_material",
                  unitOfMeasure: "",
                  availableQty: 0,
                  isOutOfWipStock: false,
                  isSharedCost: false,
                  amount: 0, // Will be calculated later
                };
              }
            })
            .filter(Boolean); // Remove any null entries (invalid ingredients)

          console.log(
            `[${product.productName}] Final ingredients loaded: ${
              ingredients.length
            } (${
              ingredients.filter((i) => isIngredientType(i.type)).length
            } raw, ${
              ingredients.filter((i) => i.type === "other").length
            } other, ${
              ingredients.filter((i) => i.type === "by_product_credit").length
            } by-product)`,
          );

          console.log(
            `[${product.productName}] Loaded ${ingredients.length} ingredients from JSON:`,
            ingredients.map((i) => i.product?.item_name),
          );

          return {
            id: Date.now() + index,
            type: costingType,
            engineName:
              product.engineName ||
              actualProduct?.item_name ||
              fallbackProduct?.item_name ||
              "",
            finishedGoods: [
              createEmptyFinishedGood({
                id: Date.now() + index + 1000,
                finishedGood: actualProduct || fallbackProduct,
                operatorEntries: [
                  createOperatorEntry({
                    engineName:
                      product.engineName ||
                      actualProduct?.item_name ||
                      fallbackProduct?.item_name ||
                      "",
                  }),
                ],
                multiplierValue:
                  product.units != null
                    ? parseFloat(product.units) || 1.0
                    : 1.0,
                units: product.units != null ? product.units : null,
                unitOfMeasure: actualProduct?.unit_of_measure || "",
                ...defaultBranchFields,
              }),
            ],
            ingredients: ingredients,
            sharedCosts: parsedSharedCosts,
          };
        });

        // Set production items with ingredients loaded from JSON
        // Log what we're setting to verify it matches the template
        console.log(
          `[handleProductGroupChange] Setting ${newProductionItems.length} production items:`,
          newProductionItems.map((item) => ({
            productName:
              item.finishedGoods[0]?.finishedGood?.item_name ||
              item.finishedGoods[0]?.finishedGood?.name,
            productSku:
              item.finishedGoods[0]?.finishedGood?.sku ||
              item.finishedGoods[0]?.finishedGood?.item_code,
            ingredientsCount: item.ingredients?.length || 0,
          })),
        );

        setProductionItems(newProductionItems);
        console.log(
          `Loaded ${newProductionItems.length} production items with ingredients from JSON`,
        );

        // Calculate total items (ingredients) across all products
        // Log detailed breakdown for debugging
        newProductionItems.forEach((item, idx) => {
          const productName =
            item.finishedGoods[0]?.finishedGood?.item_name ||
            `Product ${idx + 1}`;
          console.log(
            `[${productName}] Has ${
              item.ingredients?.length || 0
            } ingredients:`,
            item.ingredients?.map((ing) => ({
              type: ing.type,
              description: ing.description || ing.product?.item_name,
            })),
          );
        });

        const totalItems = newProductionItems.reduce(
          (sum, item) => sum + (item.ingredients?.length || 0),
          0,
        );

        // Build breakdown message showing items per product
        const productBreakdown = newProductionItems
          .map((item, idx) => {
            const productName =
              item.finishedGoods[0]?.finishedGood?.item_name ||
              `Product ${idx + 1}`;
            const itemCount = item.ingredients?.length || 0;
            return `${productName} (${itemCount} item${
              itemCount !== 1 ? "s" : ""
            })`;
          })
          .join(", ");

        console.log(
          `Total items calculated: ${totalItems} from ${newProductionItems.length} products`,
        );

        // Show success message with detailed breakdown
        const message = `Loaded ${newProductionItems.length} product(s) with ${totalItems} item(s) and ${parsedSharedCosts.length} shared cost(s) from template. ${productBreakdown}`;
        toast.success(message);
      } else {
        // If no products found, clear production items and shared costs
        setProductionItems([]);
        setSharedCostsFromGroup([]);
        setSharedCostOutputPercentage(1);
        toast.warning("No products found in the selected template");
      }
    } else {
      // If no notes or template data, clear all state
      setSharedCostsFromGroup([]);
      setProductionItems([]);
      setSharedCostOutputPercentage(1);
    }
  };

  const handleActualProductGroupChange = (groupId) => {
    const group = groupId
      ? productGroups.find((g) => g.id === parseInt(groupId, 10))
      : null;
    setSelectedActualProductGroup(group);
    if (!group?.notes) return;

    const actualRecipe = parseSharedCostsFromNotes(group.notes).filter((c) =>
      isIngredientType(c.type),
    );
    setSharedCostsFromGroup((prev) =>
      prev.map((cost) => {
        if (!isIngredientType(cost.type)) return cost;
        if (cost.isActualQtyManuallySet) return cost;
        const match = actualRecipe.find(
          (a) =>
            String(a.rawMaterialSku || "") === String(cost.rawMaterialSku || ""),
        );
        if (!match) return cost;
        // Don't auto-fill actualQty from template — keep at 0 for user to enter
        return {
          ...cost,
          actualQty: "0",
          isActualQtyManuallySet: false,
        };
      }),
    );
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
    // Remove commas and keep only numbers and decimal point
    return value.replace(/,/g, "");
  };

  // Helper function to get numeric quantity (similar to Markup.jsx)
  const getNumericQuantity = (quantity) => {
    if (!quantity || quantity === "") return 0;
    if (typeof quantity === "number") return quantity;
    const parsed = parseNumberFromFormatted(String(quantity));
    return parseFloat(parsed) || 0;
  };

  /** Multiplier / Value for joint_shared — user input wins over template units. */
  const getFinishedGoodMultiplierValue = (fg) => {
    if (!fg) return 1.0;
    if (
      fg.multiplierValue !== undefined &&
      fg.multiplierValue !== null &&
      String(fg.multiplierValue).trim() !== ""
    ) {
      const mv = parseFloat(fg.multiplierValue);
      if (!Number.isNaN(mv) && mv > 0) return mv;
    }
    if (fg.units != null && fg.units !== "") {
      const u = parseFloat(fg.units);
      if (!Number.isNaN(u) && u > 0) return u;
    }
    if (fg.multiplier?.multiplier_value) {
      const mv = parseFloat(fg.multiplier.multiplier_value);
      if (!Number.isNaN(mv) && mv > 0) return mv;
    }
    return 1.0;
  };

  // Scale factor: prefer actual raw-material usage ÷ recipe; else FG output ÷ template output
  useEffect(() => {
    if (costingType !== "joint_shared") return;

    const fromRawMaterials =
      computeSharedCostScaleFromRawMaterials(sharedCostsFromGroup);
    if (fromRawMaterials != null && fromRawMaterials > 0) {
      setSharedCostQtyUse(fromRawMaterials);
      return;
    }

    const outputUnits = parseFloat(sharedCostOutputPercentage || 1);
    if (!outputUnits || outputUnits <= 0) return;

    let totalMult = 0;
    for (const productionItem of productionItems) {
      for (const finishedGood of productionItem.finishedGoods || []) {
        const quantity = getNumericQuantity(finishedGood.quantity);
        const multiplierValue = getFinishedGoodMultiplierValue(finishedGood);
        totalMult += quantity * multiplierValue;
      }
    }

    if (!totalMult || totalMult <= 0) {
      setSharedCostQtyUse(1);
      return;
    }
    setSharedCostQtyUse(parseFloat((totalMult / outputUnits).toFixed(4)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inline loop uses getNumericQuantity; productionItems covers FG changes
  }, [
    costingType,
    sharedCostOutputPercentage,
    productionItems,
    sharedCostsFromGroup,
  ]);

  useEffect(() => {
    fetchFinishedGoodProducts();
  }, [fetchFinishedGoodProducts]);

  // Expand first production item by default
  useEffect(() => {
    if (productionItems.length > 0 && !expandedItem) {
      setExpandedItem(productionItems[0].id);
    }
  }, [productionItems, expandedItem]);

  useEffect(() => {
    if (
      templateByProductItems.length === 0 ||
      rawMaterialProducts.length === 0
    ) {
      return;
    }
    setTemplateByProductItems((prev) =>
      prev.map((item) =>
        item.product && !item.isOutOfWipStock
          ? item
          : enrichTemplateByProductItem(item),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaterialProducts]);

  useEffect(() => {
    loadTemplateByProductOptions();
  }, [loadTemplateByProductOptions]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (branchOptions.length === 0) return;
    setTemplateByProductBranchId((prev) => {
      const p = String(prev ?? "").trim();
      if (p && branchOptions.some((b) => String(b.id) === p)) return p;
      const fgBranchId = productionItems
        .flatMap((pi) => pi.finishedGoods || [])
        .map((fg) => fg.branchLocationId)
        .find(
          (id) =>
            id != null &&
            String(id).trim() !== "" &&
            String(id) !== "0" &&
            branchOptions.some((b) => String(b.id) === String(id)),
        );
      if (fgBranchId != null) return String(fgBranchId);
      return String(branchOptions[0].id);
    });
  }, [branchOptions, productionItems, selectedTemplateByProduct]);

  useEffect(() => {
    if (!branchOptions.length) return;
    setProductionItems((prev) => {
      const first = branchOptions[0];
      if (!first) return prev;
      let changed = false;
      const next = prev.map((item) => ({
        ...item,
        finishedGoods: item.finishedGoods.map((fg) => {
          if (!fg.finishedGood) return fg;
          const hasValidBranch =
            (fg.branchLocationId != null &&
              String(fg.branchLocationId) !== "" &&
              String(fg.branchLocationId) !== "0" &&
              branchOptions.some(
                (b) => String(b.id) === String(fg.branchLocationId),
              )) ||
            String(fg.branch_id || "").trim();
          if (hasValidBranch) return fg;
          changed = true;
          return {
            ...fg,
            branchLocationId: first.id,
            branch_id: first.branch_id || "",
            branch_name: first.storeName || first.branch_name || "",
          };
        }),
      }));
      return changed ? next : prev;
    });
  }, [branchOptions]);

  useEffect(() => {
    if (templateByProductOptions.length === 0) return;
    const meta = pendingTemplateByProductMeta;
    if (meta) {
      const resolved = resolveTemplateByProductSelection(
        meta.pid,
        meta.pname,
        meta.psku,
        meta.itemCode,
        templateByProductOptions,
      );
      if (
        resolved &&
        templateByProductOptions.some(
          (p) => String(p.id) === String(resolved.id),
        )
      ) {
        setSelectedTemplateByProduct(resolved);
        setPendingTemplateByProductMeta(null);
      }
    } else if (selectedTemplateByProduct?.id) {
      const resolved = resolveTemplateByProductSelection(
        selectedTemplateByProduct.id,
        selectedTemplateByProduct.name || selectedTemplateByProduct.item_name,
        selectedTemplateByProduct.sku || selectedTemplateByProduct.item_code,
        selectedTemplateByProduct.item_code,
        templateByProductOptions,
      );
      if (
        resolved &&
        templateByProductOptions.some(
          (p) => String(p.id) === String(resolved.id),
        )
      ) {
        setSelectedTemplateByProduct(resolved);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateByProductOptions]);

  // Update shared costs and production items with products when rawMaterialProducts are loaded
  // NOTE: This useEffect should NOT interfere with data loaded by handleProductGroupChange
  // It only updates product references for existing items, not re-parse the template
  useEffect(() => {
    // Only run if we have a selected group AND raw materials are loaded
    // AND we already have production items (meaning template was loaded by handleProductGroupChange)
    // This ensures we don't overwrite fresh template data
    if (
      selectedProductGroup &&
      (rawMaterialProducts.length > 0 || rawMaterialCatalog.length > 0) &&
      productionItems.length > 0
    ) {
      // Only update product references for existing items, don't re-parse template
      // Re-process the product group data to ensure raw materials are properly matched
      if (selectedProductGroup.notes) {
        // Try to parse JSON to extract output value
        try {
          let notesToParse = selectedProductGroup.notes;
          if (
            typeof notesToParse === "string" &&
            notesToParse.trim().startsWith('"')
          ) {
            notesToParse = JSON.parse(notesToParse);
          }
          const costingData = JSON.parse(notesToParse);
          if (costingData && costingData.output !== undefined) {
            const outputValue = parseFloat(costingData.output) || 1;
            setSharedCostOutputPercentage(outputValue);
          }
        } catch (e) {
          // If JSON parsing fails, try old format or ignore
        }

        // Only update shared costs if they're not already loaded (avoid overwriting data loaded in handleProductGroupChange)
        // Only update product references for existing shared costs, don't re-parse if already loaded
        if (sharedCostsFromGroup.length === 0) {
          const parsedSharedCosts = parseSharedCostsFromNotes(
            selectedProductGroup.notes,
          );
          setSharedCostsFromGroup(
            initializeSharedCostActualQty(
              parsedSharedCosts.map((cost) =>
                isIngredientType(cost.type) ? enrichSharedCostItem(cost) : cost,
              ),
            ),
          );
        } else {
          const sharedCostsWithProducts = sharedCostsFromGroup.map((cost) =>
            isIngredientType(cost.type) ? enrichSharedCostItem(cost) : cost,
          );
          const hasChanges = sharedCostsWithProducts.some(
            (cost, index) =>
              cost.product !== sharedCostsFromGroup[index]?.product ||
              cost.rawMaterialSku !== sharedCostsFromGroup[index]?.rawMaterialSku,
          );
          if (hasChanges) {
            setSharedCostsFromGroup(sharedCostsWithProducts);
          }
        }

        // Also update production items' ingredients with available quantities
        setProductionItems((prevItems) =>
          prevItems.map((item) => ({
            ...item,
            ingredients: item.ingredients.map((ingredient) => {
              if (!isIngredientType(ingredient.type || "raw_material")) {
                return ingredient;
              }
              const updatedProduct = findWipProductMatch(ingredient);
              if (updatedProduct) {
                const availableQty = getRmAvailableQty(updatedProduct);
                return {
                  ...ingredient,
                  product: updatedProduct,
                  availableQty,
                  isOutOfWipStock: availableQty <= 0,
                  unit_cost: getSharedCostUnitCost(
                    ingredient.rate ??
                      ingredient.rate_amount ??
                      ingredient.unit_cost,
                    updatedProduct,
                  ),
                };
              }
              // Keep selected product info but mark out of WIP when no live balance
              if (ingredient.product) {
                return {
                  ...ingredient,
                  availableQty: 0,
                  isOutOfWipStock: true,
                };
              }
              return ingredient;
            }),
          })),
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rawMaterialProducts,
    rawMaterialCatalog,
    selectedProductGroup,
    productionItems.length,
  ]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const addProductionItem = () => {
    setProductionItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        engineName: "",
        finishedGoods: [createEmptyFinishedGood({ id: Date.now() + 1 })],
        ingredients: [
          {
            id: Date.now() + 2,
            product: null,
            quantity: "",
            actualQty: "",
            unitOfMeasure: "",
            availableQty: 0,
          },
        ],
      },
    ]);
    setExpandedItem(Date.now());
  };

  const removeProductionItem = (productionItemId) => {
    if (productionItems.length <= 1) {
      toast.error("At least one production item is required");
      return;
    }
    setProductionItems((prev) =>
      prev.filter((item) => item.id !== productionItemId),
    );
    toast.success("Production item removed");
  };

  const getReferenceNum = useCallback(() => {
    _fetchApi(
      `/get-and-update/batch_no/${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          const randomNum = `${resp.results}`.padStart(5, "0");
          const refNumber = `Batch-${randomNum}`;
          setBatchNo(refNumber);
        }
      },
      (err) => {
        toast.error(`Error generating SKU:${err}`);
      },
    );
  }, [activeBusiness.id]);

  useEffect(() => {
    if (!resumeBatchId) {
      getReferenceNum();
    }
  }, [getReferenceNum, resumeBatchId]);

  /** Same By-Product filter as ProductList (/api/products → item_type === "By-Product") */
  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/api/products?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success && Array.isArray(resp.data)) {
          const rows = resp.data
            .filter((p) => String(p.item_type || "").trim() === "By-Product")
            .map((p) => ({
              id: p.id,
              item_name: p.name || p.item_name,
              sku: p.sku || p.item_code,
              item_code: p.item_code || p.sku,
              inventory_account: p.inventory_account || "",
              item_type: p.item_type,
            }));
          setByProductWasteOptions(rows);
        }
      },
      () => {},
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (!resumeBatchId || !activeBusiness?.id) return;

    _fetchApi(
      `/api/production/manufacturing-records?facilityId=${activeBusiness.id}&page=1&limit=1000`,
      (resp) => {
        if (!resp.success) return;
        const records = resp.data?.productionRecords || [];
        const resumedRecord = records.find(
          (record) => String(record.id) === String(resumeBatchId),
        );
        if (!resumedRecord) {
          toast.error("Resume batch not found");
          return;
        }

        let recordData = {};
        try {
          recordData =
            typeof resumedRecord.data === "string"
              ? JSON.parse(resumedRecord.data)
              : resumedRecord.data || {};
        } catch (e) {
          recordData = {};
        }

        const resumeRunStatus = String(
          recordData.runStatus || resumedRecord.run_status || "",
        )
          .trim()
          .toLowerCase();
        if (resumeRunStatus === "closed" || resumeRunStatus === "close") {
          toast.error("This run is closed and cannot be resumed");
          navigate("/app/production/record-production");
          return;
        }

        const sj = recordData.sharedJointWaste;
        if (sj && typeof sj === "object") {
          setSharedJointWasteType(sj.wasteType || "normal");
          const scrap = sj.scrapProduct || sj.scrapByProduct;
          let costVal = sj.scrapByProductCost ?? sj.scrapProductCost;
          let qtyVal = sj.scrapByProductQty ?? sj.scrapProductQty;
          if (scrap && typeof scrap === "object") {
            const {
              cost: embeddedCost,
              quantity: embeddedQty,
              ...scrapRest
            } = scrap;
            setSharedJointScrapByProductSelection([scrapRest]);
            if (embeddedCost !== undefined && embeddedCost !== null) {
              costVal = embeddedCost;
            }
            if (embeddedQty !== undefined && embeddedQty !== null) {
              qtyVal = embeddedQty;
            }
          } else {
            setSharedJointScrapByProductSelection([]);
          }
          if (costVal !== undefined && costVal !== null && costVal !== "") {
            setSharedJointScrapCost(String(costVal));
          } else {
            setSharedJointScrapCost("");
          }
          if (qtyVal !== undefined && qtyVal !== null && qtyVal !== "") {
            setSharedJointScrapQty(String(qtyVal));
          } else {
            setSharedJointScrapQty("");
          }
        }
        let resumedQtyUse = sharedCostQtyUse;
        if (recordData.qtyUse != null && recordData.qtyUse !== "") {
          const qu = parseFloat(recordData.qtyUse);
          if (!Number.isNaN(qu) && qu > 0) {
            resumedQtyUse = qu;
            setSharedCostQtyUse(qu);
          }
        }
        applyTemplateByProductFromCostingData(recordData, resumedQtyUse);
        const priorProducts = recordData.products || [];

        setIsResumeMode(true);
        setBatchNo(resumedRecord.id);
        setForm((prev) => ({
          ...prev,
          productionDate: resumedRecord.production_date
            ? moment(resumedRecord.production_date).format("YYYY-MM-DD")
            : prev.productionDate,
          notes: resumedRecord.notes || prev.notes,
        }));

        setResumeSessionHistory({
          batchId: resumedRecord.id,
          createdAt: resumedRecord.created_at,
          runStatus: recordData.runStatus || resumedRecord.status || "partial",
          items: priorProducts,
        });
        setSessionHistory(
          Array.isArray(recordData.sessionHistory)
            ? recordData.sessionHistory
            : [],
        );

        if (Array.isArray(priorProducts) && priorProducts.length > 0) {
          const resumedItems = priorProducts.map((product, idx) => {
            const prevFg = product.finishedGoods?.[0] || {};
            const prevGood = parseFloat(prevFg.goodQuantity || 0);
            const prevWaste = parseFloat(prevFg.wasteQuantity || 0);
            const expected = parseFloat(prevFg.expectedQty || 0);
            const remainingQty = Math.max(expected - (prevGood + prevWaste), 0);

            return {
              id: Date.now() + idx,
              type: product.type || costingType,
              engineName:
                product.engineName ||
                prevFg.finishedGood?.item_name ||
                product.productName ||
                "",
              finishedGoods: [
                createEmptyFinishedGood({
                  id: Date.now() + idx + 1000,
                  finishedGood: prevFg.finishedGood || null,
                  operator: prevFg.operator || "",
                  operatorEntries:
                    Array.isArray(prevFg.operatorEntries) &&
                    prevFg.operatorEntries.length
                      ? prevFg.operatorEntries.map((e) =>
                          createOperatorEntry({
                            ...e,
                            goodQuantity: "",
                            wasteQuantity: "",
                          }),
                        )
                      : [
                          createOperatorEntry({
                            operator: prevFg.operator || "",
                          }),
                        ],
                  expectedQty: expected ? String(expected) : "",
                  goodQuantity: "",
                  wasteQuantity: "",
                  previousGoodQuantity: prevGood,
                  previousWasteQuantity: prevWaste,
                  wasteType: prevFg.wasteType || "",
                  wasteReason: prevFg.wasteReason || "",
                  wasteScrapByProductSelection:
                    prevFg.wasteScrapByProductSelection || [],
                  wasteAbnormalLossExpenseSelection:
                    prevFg.wasteAbnormalLossExpenseSelection || [],
                  shortfallReason: prevFg.shortfallReason || "",
                  sessionStartTime:
                    prevFg.sessionStartTime || new Date().toISOString(),
                  sessionEndTime: prevFg.sessionEndTime || "",
                  remainingQty,
                  multiplier: prevFg.multiplier || null,
                  multiplierValue: prevFg.multiplierValue || 1.0,
                  units: prevFg.units || null,
                  batchNo: resumedRecord.id,
                  warehouse: prevFg.warehouse || "",
                  unitOfMeasure:
                    prevFg.unitOfMeasure ||
                    prevFg.finishedGood?.unit_of_measure ||
                    "",
                  category: prevFg.category || "",
                  branchLocationId:
                    prevFg.branchLocationId ??
                    prevFg.branch_location_id ??
                    null,
                  branch_id: prevFg.branch_id ?? "",
                  branch_name: prevFg.branch_name ?? "",
                }),
              ],
              ingredients: (product.ingredients || []).map((ing, ingIdx) => ({
                id: Date.now() + idx + ingIdx + 2000,
                ...ing,
                actualQty: ing.actualQty && String(ing.actualQty).trim() !== "" ? String(ing.actualQty) : "0",
              })),
              sharedCosts: product.sharedCosts || [],
            };
          });

          setProductionItems(resumedItems);
        }
      },
      (err) => {
        console.error("Error loading resume batch:", err);
        toast.error("Error loading batch for resume");
      },
    );
  }, [resumeBatchId, activeBusiness?.id, costingType]);

  const addFinishedGood = (productionItemId) => {
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          return {
            ...item,
            finishedGoods: [
              ...item.finishedGoods,
              createEmptyFinishedGood({ id: Date.now() }),
            ],
          };
        }
        return item;
      }),
    );
  };

  const handleEngineNameChange = (productionItemId, value) => {
    setProductionItems((prev) =>
      prev.map((item) =>
        item.id === productionItemId ? { ...item, engineName: value } : item,
      ),
    );
  };

  const removeFinishedGood = (productionItemId, finishedGoodId) => {
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          if (item.finishedGoods.length <= 1) {
            toast.error("At least one finished good is required");
            return item;
          }
          return {
            ...item,
            finishedGoods: item.finishedGoods.filter(
              (fg) => fg.id !== finishedGoodId,
            ),
          };
        }
        return item;
      }),
    );
  };

  const handleFinishedGoodBranchChange = (
    productionItemId,
    finishedGoodId,
    branchTableId,
  ) => {
    const row = branchOptions.find(
      (b) => String(b.id) === String(branchTableId),
    );
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id !== productionItemId) return item;
        return {
          ...item,
          finishedGoods: item.finishedGoods.map((fg) => {
            if (fg.id !== finishedGoodId) return fg;
            if (!row || !branchTableId) {
              return {
                ...fg,
                branchLocationId: null,
                branch_id: "",
                branch_name: "",
              };
            }
            return {
              ...fg,
              branchLocationId: row.id,
              branch_id: row.branch_id || "",
              branch_name: row.storeName || row.branch_name || "",
            };
          }),
        };
      }),
    );
  };

  const handleFinishedGoodChange = (
    productionItemId,
    finishedGoodId,
    field,
    value,
  ) => {
    if (field === "finishedGood" && value) {
      fetchProductsWithMultipliers(value.item_code);

      // For job-specific/template-driven production, auto-populate ingredients from costing template
      const shouldPopulateFromTemplate =
        costingType === "job_specific" ||
        activeBusiness?.costing_method === "job_product_costing";
      if (shouldPopulateFromTemplate) {
        // Use a small delay to ensure costing templates are loaded
        setTimeout(() => {
          // Try multiple ID fields to match the finished good
          const productId = value.id || value.product_id || value.item_code;
          populateIngredientsFromCostingTemplate(productionItemId, productId);
        }, 200);
      }
    }

    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          const updatedFinishedGoods = item.finishedGoods.map((fg) => {
            if (fg.id === finishedGoodId) {
              const updatedFinishedGood = { ...fg, [field]: value };

              if (field === "finishedGood") {
                if (value && branchOptions.length > 0) {
                  const first = branchOptions[0];
                  updatedFinishedGood.branchLocationId = first.id;
                  updatedFinishedGood.branch_id = first.branch_id || "";
                  updatedFinishedGood.branch_name =
                    first.storeName || first.branch_name || "";
                } else {
                  updatedFinishedGood.branchLocationId = null;
                  updatedFinishedGood.branch_id = "";
                  updatedFinishedGood.branch_name = "";
                }
              }

              if (field === "finishedGood" && value) {
                updatedFinishedGood.batchNo = batchNo;
                updatedFinishedGood.unitOfMeasure = value.unit_of_measure || "";
                updatedFinishedGood.category = value.category || "";
                if (value.units != null) {
                  updatedFinishedGood.units = value.units;
                }
              }

              // Handle quantity formatting (similar to debit/credit in JournalEntryForm)
              if (field === "quantity") {
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
                updatedFinishedGood.quantity = numericValue; // Store numeric value
                updatedFinishedGood.quantity_formatted = formattedValue; // Store formatted value for display
              }

              if (field === "goodQuantity") {
                let nextValue = applyDecimalQtyBounds(value, { min: 0 });
                const expectedQty = Number(
                  updatedFinishedGood.expectedQty || 0,
                );
                const currentWaste = Number(
                  updatedFinishedGood.wasteQuantity || 0,
                );
                const requested = parseFloat(nextValue);
                if (
                  expectedQty > 0 &&
                  nextValue !== "" &&
                  !String(nextValue).endsWith(".") &&
                  Number.isFinite(requested) &&
                  requested + currentWaste > expectedQty
                ) {
                  const allowed = Math.max(expectedQty - currentWaste, 0);
                  toast.warning(
                    `Good Qty adjusted so Good + Waste stays within Expected Qty (${expectedQty.toFixed(
                      4,
                    )})`,
                  );
                  nextValue = String(allowed);
                } else if (
                  isResumeMode &&
                  updatedFinishedGood.remainingQty !== undefined &&
                  updatedFinishedGood.remainingQty !== null &&
                  nextValue !== "" &&
                  !String(nextValue).endsWith(".") &&
                  Number.isFinite(requested)
                ) {
                  const remaining = Number(
                    updatedFinishedGood.remainingQty || 0,
                  );
                  if (requested + currentWaste > remaining) {
                    const allowed = Math.max(remaining - currentWaste, 0);
                    toast.warning(
                      `Good Quantity adjusted to remaining allowable qty (${allowed.toFixed(
                        4,
                      )})`,
                    );
                    nextValue = String(allowed);
                  }
                }
                updatedFinishedGood.goodQuantity = nextValue;
                updatedFinishedGood.quantity = nextValue;
                updatedFinishedGood.quantity_formatted =
                  formatNumberWithCommas(nextValue);
              }

              if (field === "multiplierValue") {
                const parsed = parseFloat(value);
                const mv = !Number.isNaN(parsed) && parsed > 0 ? parsed : 1.0;
                updatedFinishedGood.multiplierValue = mv;
                updatedFinishedGood.units = mv;
              }

              if (field === "wasteQuantity") {
                let nextValue = applyDecimalQtyBounds(value, { min: 0 });
                const expectedQty = Number(
                  updatedFinishedGood.expectedQty || 0,
                );
                const currentGood = Number(
                  updatedFinishedGood.goodQuantity || 0,
                );
                const requested = parseFloat(nextValue);
                if (
                  expectedQty > 0 &&
                  nextValue !== "" &&
                  !String(nextValue).endsWith(".") &&
                  Number.isFinite(requested) &&
                  requested + currentGood > expectedQty
                ) {
                  const allowed = Math.max(expectedQty - currentGood, 0);
                  toast.warning(
                    `Waste Qty adjusted so Good + Waste stays within Expected Qty (${expectedQty.toFixed(
                      4,
                    )})`,
                  );
                  nextValue = String(allowed);
                } else if (
                  isResumeMode &&
                  updatedFinishedGood.remainingQty !== undefined &&
                  updatedFinishedGood.remainingQty !== null &&
                  nextValue !== "" &&
                  !String(nextValue).endsWith(".") &&
                  Number.isFinite(requested)
                ) {
                  const remaining = Number(
                    updatedFinishedGood.remainingQty || 0,
                  );
                  if (requested + currentGood > remaining) {
                    const allowed = Math.max(remaining - currentGood, 0);
                    toast.warning(
                      `Waste Quantity adjusted to remaining allowable qty (${allowed.toFixed(
                        4,
                      )})`,
                    );
                    nextValue = String(allowed);
                  }
                }
                updatedFinishedGood.wasteQuantity = nextValue;
                const finalWaste = parseFloat(nextValue) || 0;
                if (finalWaste <= 0 && !String(nextValue).endsWith(".")) {
                  updatedFinishedGood.wasteType = "";
                  updatedFinishedGood.wasteReason = "";
                  updatedFinishedGood.wasteScrapByProductSelection = [];
                  updatedFinishedGood.wasteAbnormalLossExpenseSelection = [];
                }
              }

              if (field === "wasteType") {
                const vt = String(value || "")
                  .trim()
                  .toLowerCase();
                if (vt !== "recyclable") {
                  updatedFinishedGood.wasteScrapByProductSelection = [];
                }
                if (vt !== "abnormal") {
                  updatedFinishedGood.wasteAbnormalLossExpenseSelection = [];
                } else if (
                  !(
                    updatedFinishedGood.wasteAbnormalLossExpenseSelection
                      ?.length > 0
                  )
                ) {
                  updatedFinishedGood.wasteAbnormalLossExpenseSelection =
                    resolveDefaultAbnormalLossSelection();
                }
              }

              if (
                field === "goodQuantity" ||
                field === "wasteQuantity" ||
                field === "expectedQty"
              ) {
                const expectedQty = Number(
                  updatedFinishedGood.expectedQty || 0,
                );
                const currentOutput =
                  Number(updatedFinishedGood.goodQuantity || 0) +
                  Number(updatedFinishedGood.wasteQuantity || 0);

                if (expectedQty > 0 && currentOutput === expectedQty) {
                  if (!updatedFinishedGood.sessionEndTime) {
                    updatedFinishedGood.sessionEndTime =
                      new Date().toISOString();
                  }
                } else if (expectedQty <= 0 || currentOutput !== expectedQty) {
                  updatedFinishedGood.sessionEndTime = "";
                }
              }

              if (field === "expectedQty") {
                const sanitizedExpected = applyDecimalQtyBounds(value, {
                  min: 0,
                });
                updatedFinishedGood.expectedQty = sanitizedExpected;
                const entries =
                  Array.isArray(updatedFinishedGood.operatorEntries) &&
                  updatedFinishedGood.operatorEntries.length
                    ? updatedFinishedGood.operatorEntries.map((e) => ({ ...e }))
                    : [];
                const cap = getOperatorQtyCap(
                  { ...updatedFinishedGood, expectedQty: sanitizedExpected },
                  isResumeMode,
                );
                if (cap != null && entries.length) {
                  const clamped = clampOperatorEntriesToCap(entries, cap);
                  const before = sumOperatorEntries(entries);
                  const after = sumOperatorEntries(clamped);
                  if (before.good + before.waste > after.good + after.waste) {
                    toast.warning(
                      `Operator quantities adjusted to Expected Qty (${cap.toFixed(4)})`,
                    );
                  }
                  return applyOperatorEntryTotals(
                    {
                      ...updatedFinishedGood,
                      expectedQty: sanitizedExpected,
                      operatorEntries: clamped,
                    },
                    formatNumberWithCommas,
                  );
                }
              }

              return updatedFinishedGood;
            }
            return fg;
          });

          const shouldAutoSetEngineName =
            field === "finishedGood" &&
            value &&
            (!item.engineName || !String(item.engineName).trim());

          const fieldsAffectingIngredients = [
            "goodQuantity",
            "wasteQuantity",
            "wasteType",
          ];
          const nextIngredients = fieldsAffectingIngredients.includes(field)
            ? syncIngredientsToOutputQty(item.ingredients, updatedFinishedGoods)
            : item.ingredients;

          const nextFinishedGoods =
            field === "finishedGood" && value
              ? updatedFinishedGoods.map((fg) => {
                  if (fg.id !== finishedGoodId) return fg;
                  const entries =
                    Array.isArray(fg.operatorEntries) && fg.operatorEntries.length
                      ? fg.operatorEntries
                      : [createOperatorEntry()];
                  const productName = value.item_name || value.name || "";
                  return {
                    ...fg,
                    operatorEntries: entries.map((entry, idx) =>
                      idx === 0 && !String(entry.engineName || "").trim()
                        ? { ...entry, engineName: productName }
                        : entry,
                    ),
                  };
                })
              : updatedFinishedGoods;

          return {
            ...item,
            ...(shouldAutoSetEngineName
              ? { engineName: value.item_name || value.name || "" }
              : {}),
            finishedGoods: nextFinishedGoods,
            ingredients: nextIngredients,
          };
        }
        return item;
      }),
    );

    if (field === "wasteType") {
      const vt = String(value || "")
        .trim()
        .toLowerCase();
      if (vt === "recyclable") {
        const fid = finishedGoodId;
        setTimeout(() => {
          const byId = document.getElementById(`record-scrap-bp-input-${fid}`);
          if (byId && typeof byId.focus === "function") {
            byId.focus();
            return;
          }
          const wrap = document.getElementById(`record-scrap-bp-${fid}`);
          wrap
            ?.querySelector?.(
              "input.rbt-input-main, input.rbt-input, input.form-control",
            )
            ?.focus?.();
        }, 150);
      }
    }
  };

  const updateFinishedGoodOperatorEntries = (
    productionItemId,
    finishedGoodId,
    nextEntries,
    editMeta = {},
  ) => {
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id !== productionItemId) return item;
        const updatedFinishedGoods = item.finishedGoods.map((fg) => {
          if (fg.id !== finishedGoodId) return fg;
          const cap = getOperatorQtyCap(fg, isResumeMode);
          if (cap == null && editMeta.requireCap) {
            toast.error("Enter Expected Qty before recording operator quantities");
            return fg;
          }

          let entries = (nextEntries || []).map((e) => ({ ...e }));
          const before = sumOperatorEntries(entries);
          entries = clampOperatorEntriesToCap(entries, cap, editMeta);
          const after = sumOperatorEntries(entries);

          // Toast only when clamp actually reduced totals (fallback safety)
          if (
            cap != null &&
            before.good + before.waste > after.good + after.waste + 1e-9 &&
            !editMeta.editedField
          ) {
            toast.warning(
              `Good + Waste cannot exceed Expected Qty (${cap.toFixed(4)})`,
            );
          }

          // Clear waste type when waste qty is zero
          entries = entries.map((e) => {
            if ((parseFloat(e.wasteQuantity) || 0) <= 0) {
              return {
                ...e,
                wasteType: "",
                wasteScrapByProductSelection: [],
                wasteAbnormalLossExpenseSelection: [],
                wasteReason: "",
              };
            }
            return e;
          });

          const updated = applyOperatorEntryTotals(
            { ...fg, operatorEntries: entries },
            formatNumberWithCommas,
          );

          const expected = Number(updated.expectedQty || 0);
          const currentOutput =
            Number(updated.goodQuantity || 0) +
            Number(updated.wasteQuantity || 0);
          if (expected > 0 && currentOutput === expected) {
            if (!updated.sessionEndTime) {
              updated.sessionEndTime = new Date().toISOString();
            }
          } else {
            updated.sessionEndTime = "";
          }
          return updated;
        });

        return {
          ...item,
          engineName:
            updatedFinishedGoods
              .flatMap((fg) => fg.operatorEntries || [])
              .map((e) => String(e.engineName || "").trim())
              .find(Boolean) ||
            item.engineName ||
            "",
          finishedGoods: updatedFinishedGoods,
          ingredients: syncIngredientsToOutputQty(
            item.ingredients,
            updatedFinishedGoods,
          ),
        };
      }),
    );
  };

  const handleAddOperatorEntry = (productionItemId, finishedGoodId) => {
    const fg = productionItems
      .find((i) => i.id === productionItemId)
      ?.finishedGoods?.find((f) => f.id === finishedGoodId);
    const current =
      Array.isArray(fg?.operatorEntries) && fg.operatorEntries.length
        ? fg.operatorEntries
        : [createOperatorEntry({ operator: fg?.operator || "" })];
    updateFinishedGoodOperatorEntries(productionItemId, finishedGoodId, [
      ...current,
      createOperatorEntry(),
    ]);
  };

  const handleRemoveOperatorEntry = (
    productionItemId,
    finishedGoodId,
    entryId,
  ) => {
    const fg = productionItems
      .find((i) => i.id === productionItemId)
      ?.finishedGoods?.find((f) => f.id === finishedGoodId);
    const current =
      Array.isArray(fg?.operatorEntries) && fg.operatorEntries.length
        ? fg.operatorEntries
        : [createOperatorEntry({ operator: fg?.operator || "" })];
    if (current.length <= 1) {
      toast.error("At least one operator row is required");
      return;
    }
    updateFinishedGoodOperatorEntries(
      productionItemId,
      finishedGoodId,
      current.filter((e) => e.id !== entryId),
    );
  };

  const handleOperatorEntryChange = (
    productionItemId,
    finishedGoodId,
    entryId,
    field,
    value,
  ) => {
    const fg = productionItems
      .find((i) => i.id === productionItemId)
      ?.finishedGoods?.find((f) => f.id === finishedGoodId);
    const cap = getOperatorQtyCap(fg, isResumeMode);
    if (
      (field === "goodQuantity" || field === "wasteQuantity") &&
      cap == null
    ) {
      toast.error("Enter Expected Qty before recording Good or Waste quantities");
      return;
    }
    const current =
      Array.isArray(fg?.operatorEntries) && fg.operatorEntries.length
        ? fg.operatorEntries
        : [
            createOperatorEntry({
              operator: fg?.operator || "",
              goodQuantity: fg?.goodQuantity || "",
              wasteQuantity: fg?.wasteQuantity || "",
            }),
          ];

    let nextValue = value;
    if (field === "goodQuantity" || field === "wasteQuantity") {
      nextValue = applyDecimalQtyBounds(value, { min: 0 });
      const maxAllowed = getMaxQtyForOperatorField(
        current,
        entryId,
        field,
        cap,
      );
      const raw = String(nextValue ?? "").trim();
      if (raw !== "" && !raw.endsWith(".") && maxAllowed != null) {
        const requested = parseFloat(raw);
        if (Number.isFinite(requested) && requested > maxAllowed) {
          toast.warning(
            `Cannot enter more than ${maxAllowed.toFixed(4)} (Expected Qty ${cap.toFixed(4)} − other Good/Waste)`,
          );
          nextValue = String(maxAllowed);
        } else if (Number.isFinite(requested) && requested < 0) {
          nextValue = "0";
        }
      }
    }

    const next = current.map((entry) => {
      if (entry.id !== entryId) return entry;
      const updated = { ...entry, [field]: nextValue };
      if (field === "wasteType") {
        const vt = String(nextValue || "")
          .trim()
          .toLowerCase();
        if (vt !== "recyclable") {
          updated.wasteScrapByProductSelection = [];
        }
        if (vt !== "abnormal") {
          updated.wasteAbnormalLossExpenseSelection = [];
        } else if (!(updated.wasteAbnormalLossExpenseSelection?.length > 0)) {
          updated.wasteAbnormalLossExpenseSelection =
            resolveDefaultAbnormalLossSelection();
        }
      }
      return updated;
    });
    updateFinishedGoodOperatorEntries(productionItemId, finishedGoodId, next, {
      editedEntryId: entryId,
      editedField: field,
      requireCap: field === "goodQuantity" || field === "wasteQuantity",
    });

    if (field === "wasteType") {
      const vt = String(nextValue || "")
        .trim()
        .toLowerCase();
      if (vt === "abnormal" || vt === "recyclable") {
        const inputId =
          vt === "abnormal"
            ? `record-abnormal-coa-input-${finishedGoodId}-${entryId}`
            : `record-scrap-bp-full-input-${finishedGoodId}-${entryId}`;
        setTimeout(() => {
          const byId = document.getElementById(inputId);
          if (byId && typeof byId.focus === "function") {
            byId.focus();
          }
        }, 150);
      }
    }
  };

  // Populate ingredients from costing template
  const populateIngredientsFromCostingTemplate = (
    productionItemId,
    finishedGoodProductId,
  ) => {
    if (!costingTemplates || costingTemplates.length === 0) {
      console.log("No costing templates available");
      return;
    }

    if (!finishedGoodProductId) {
      console.log("No finished good product ID provided");
      return;
    }

    // Find costing templates for this finished good product
    // Match by product ID or item_code (try multiple formats)
    const templatesForProduct = costingTemplates.filter((template) => {
      const templateProductId = String(
        template.finished_good_product_id || template.product_id || "",
      );
      const finishedGoodId = String(finishedGoodProductId || "");

      // Try exact match
      if (templateProductId === finishedGoodId) {
        return true;
      }

      // Try matching as numbers if they're numeric
      const templateNum = parseInt(templateProductId);
      const finishedNum = parseInt(finishedGoodId);
      if (
        !isNaN(templateNum) &&
        !isNaN(finishedNum) &&
        templateNum === finishedNum
      ) {
        return true;
      }

      return false;
    });

    // Load ALL ingredient types (raw_material, other, by_product_credit)
    // but only display raw_material in the UI
    const allTemplates = templatesForProduct; // Don't filter - load all types

    if (allTemplates.length === 0) {
      // No templates found, keep existing ingredients
      return;
    }

    // Map templates to ingredients - preserve type from template
    // Filter out any templates that might be finished goods (have description matching finished good)
    const newIngredients = allTemplates
      .filter((template) => {
        // Filter out any templates that appear to be invalid or finished goods
        const templateType = template.type || "raw_material";

        // For raw_material type, must have raw_material_id or raw_material_sku
        if (isIngredientType(templateType)) {
          if (!template.raw_material_id && !template.raw_material_sku) {
            return false; // Skip invalid raw_material templates
          }
        }

        // For other types, must have descriptionCode (code) to be valid
        if (templateType === "other" || templateType === "by_product_credit") {
          const hasDescriptionCode =
            template.description_code ||
            template.descriptionCode ||
            template.code;
          if (!hasDescriptionCode) {
            return false; // Skip "other" types without descriptionCode
          }
        }

        return true;
      })
      .map((template, index) => {
        // Find the raw material product from rawMaterialProducts
        // Use SKU only for matching - use item_code which is the SKU field
        const rawMaterialProduct = rawMaterialProducts.find((rm) => {
          if (template.raw_material_sku) {
            return String(rm.item_code) === String(template.raw_material_sku);
          }
          return false;
        });

        // For raw_material type, handle product lookup
        // For other types (other, by_product_credit), handle differently
        const templateType = template.type || "raw_material";

        if (isIngredientType(templateType)) {
          // default_cost: use template rate as unit_cost; system_valuation: use WIP valuation (unit_cost from API)
          const useDefaultCost =
            activeBusiness?.default_valuation_source === "default_cost";
          const templateRateValue =
            template.rate ?? template.rate_amount ?? template.Rate;
          const templateRate = parseFloat(templateRateValue);
          const hasTemplateRate =
            templateRateValue != null &&
            templateRateValue !== "" &&
            !isNaN(templateRate) &&
            templateRate >= 0;

          const unitCost =
            useDefaultCost && hasTemplateRate
              ? templateRate
              : rawMaterialProduct
                ? parseFloat(
                    rawMaterialProduct.unit_cost ||
                      rawMaterialProduct.cost_price ||
                      0,
                  )
                : hasTemplateRate
                  ? templateRate
                  : 0;

          // If not found in WIP, create a placeholder product object
          if (!rawMaterialProduct) {
            console.warn(
              `Raw material not found in WIP for template: ${template.raw_material_name} (${template.raw_material_sku})`,
            );
            return {
              id: Date.now() + index,
              type: templateType || "raw_material",
              product: {
                id: template.raw_material_id,
                product_id: template.raw_material_id,
                item_code: template.raw_material_sku,
                item_name: template.raw_material_name,
                unit_of_measure: "",
                balance: 0,
                stock_quantity: 0,
                qty: 0,
                unit_cost: unitCost,
                cost_price: unitCost,
              },
              quantity: String(template.quantity || ""),
              unitOfMeasure: "",
              unit_cost: unitCost,
              availableQty: 0,
              isOutOfWipStock: true,
            };
          }

          return {
            id: Date.now() + index,
            type: templateType || "raw_material",
            product: rawMaterialProduct,
            quantity: String(template.quantity || ""),
            unitOfMeasure: rawMaterialProduct.unit_of_measure || "",
            unit_cost: unitCost,
            availableQty:
              rawMaterialProduct.balance ||
              rawMaterialProduct.stock_quantity ||
              rawMaterialProduct.qty ||
              0,
            isOutOfWipStock: false,
          };
        } else {
          // For other types (other, by_product_credit), create ingredient without product
          const templateDescription =
            template.description || template.description_name || "";
          const templateDescriptionCode =
            template.description_code ||
            template.descriptionCode ||
            template.code ||
            "";

          // Skip if description is empty or if it appears to be a finished good name
          // (finished goods shouldn't be ingredients)
          if (!templateDescription || !templateDescriptionCode) {
            // If no description code, it's likely not a valid "other" type ingredient
            return null;
          }

          return {
            id: Date.now() + index,
            type: templateType, // Preserve type (other or by_product_credit)
            product: null, // No product for other types
            description: templateDescription,
            descriptionCode: templateDescriptionCode,
            account_head: template.account_head || template.accountHead || "",
            other_type: template.other_type || template.otherType || "rate",
            rate: template.rate || template.rate_amount || "",
            quantity: String(template.quantity || "0"), // For percentage-based, this is the percentage
            percentage_basis:
              template.percentage_basis ||
              template.percentageBasis ||
              "raw_material",
            unitOfMeasure: "",
            availableQty: 0,
            isOutOfWipStock: false,
            amount: 0, // Will be calculated later
          };
        }
      })
      .filter(Boolean); // Remove any null entries (invalid templates)

    // Update production items with new ingredients
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          return {
            ...item,
            ingredients:
              newIngredients.length > 0
                ? syncIngredientsToOutputQty(newIngredients, item.finishedGoods)
                : item.ingredients,
          };
        }
        return item;
      }),
    );

    if (newIngredients.length > 0) {
      const normalizedIngredientType = (ing) =>
        ing.type || getIngredientTypeFromProduct(ing.product);
      const rawMaterialCount = newIngredients.filter(
        (ing) => normalizedIngredientType(ing) === "raw_material",
      ).length;
      const semiFinishedCount = newIngredients.filter(
        (ing) => normalizedIngredientType(ing) === "semi_finished",
      ).length;
      const otherCount = newIngredients.filter(
        (ing) => ing.type === "other",
      ).length;
      const byProductCount = newIngredients.filter(
        (ing) => ing.type === "by_product_credit",
      ).length;
      const outOfStockCount = newIngredients.filter(
        (ing) => ing.isOutOfWipStock === true,
      ).length;
      const inStockCount =
        rawMaterialCount + semiFinishedCount - outOfStockCount;

      let message = `Loaded ${newIngredients.length} ingredient(s) from costing template`;
      message += ` (${rawMaterialCount} raw material, ${semiFinishedCount} semi finished, ${otherCount} other, ${byProductCount} by-product credit)`;
      if (outOfStockCount > 0) {
        message += ` (${inStockCount} in WIP, ${outOfStockCount} out of WIP stock)`;
      }

      if (outOfStockCount > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } else if (allTemplates.length > 0) {
      toast.warning(
        "Costing template found but ingredients could not be matched",
      );
    }
  };

  const handleCreateMultiplier = (
    inputValue,
    finishedGood,
    productionItemId,
  ) => {
    if (!finishedGood.finishedGood) {
      toast.error("Please select a product first");
      return;
    }

    // Parse the input value - expected format: "Type (Value)" or just "Type"
    const match = inputValue.match(/^(.+?)\s*\(([\d.]+)\)$/);
    let multiplierType = inputValue.trim();
    let multiplierValue = null;

    if (match) {
      multiplierType = match[1].trim();
      multiplierValue = match[2].trim();
    }

    // Store context for after modal submission
    setCreatingMultiplierContext({
      finishedGood,
      productionItemId,
      prefillType: multiplierType,
      prefillValue: multiplierValue,
    });

    // Set up form with pre-filled values if available
    const product = finishedGood.finishedGood;
    setSelectedProduct(product);
    setMultiplierForm({
      multiplier_type: multiplierType || "",
      multiplier_value: multiplierValue || "",
      product_id: product.item_code,
      product_name: product.item_name,
      sku: product.item_code,
      status: "active",
    });

    // Open modal
    setIsModalOpen(true);
  };

  const handleSaveMultiplier = () => {
    if (!multiplierForm.multiplier_type.trim()) {
      toast.error("Multiplier type is required");
      return;
    }

    if (
      !multiplierForm.multiplier_value ||
      Number(multiplierForm.multiplier_value) <= 0
    ) {
      toast.error("Multiplier value must be greater than 0");
      return;
    }

    if (!multiplierForm.product_id) {
      toast.error("Product is required");
      return;
    }

    setLoading(true);
    const payload = {
      multiplier_type: multiplierForm.multiplier_type.trim(),
      multiplier_value: Number(multiplierForm.multiplier_value),
      description: "",
      product_id: multiplierForm.product_id,
      product_name: multiplierForm.product_name,
      sku: multiplierForm.sku,
      facilityId: activeBusiness.id,
      createdBy:
        `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.id,
      status: multiplierForm.status,
    };

    _postApi(
      "/api/product-multipliers",
      payload,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          toast.success("Multiplier created successfully");

          // Refresh multipliers list if we have context
          if (creatingMultiplierContext) {
            const { finishedGood, productionItemId } =
              creatingMultiplierContext;
            fetchProductsWithMultipliers(finishedGood.finishedGood.item_code);

            // Auto-select the newly created multiplier
            setTimeout(() => {
              if (resp.data && resp.data.id) {
                handleFinishedGoodMultiplierChange(
                  productionItemId,
                  finishedGood.id,
                  resp.data.id,
                );
              }
            }, 500);
          }

          handleCancelMultiplier();
        } else {
          toast.error(resp.message || "Failed to create multiplier");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Error creating multiplier");
      },
    );
  };

  const handleCancelMultiplier = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setCreatingMultiplierContext(null);
    setMultiplierForm({
      multiplier_type: "",
      multiplier_value: "",
      product_id: "",
      product_name: "",
      sku: "",
      status: "active",
    });
  };

  const handleMultiplierInputChange = (field, value) => {
    setMultiplierForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFinishedGoodMultiplierChange = (
    productionItemId,
    finishedGoodId,
    multiplierId,
  ) => {
    const selectedMultiplier = allMultipliers.find(
      (m) => m.id === parseInt(multiplierId),
    );

    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          return {
            ...item,
            finishedGoods: item.finishedGoods.map((fg) => {
              if (fg.id === finishedGoodId) {
                return {
                  ...fg,
                  multiplier: selectedMultiplier || null,
                };
              }
              return fg;
            }),
          };
        }
        return item;
      }),
    );
  };

  const addIngredient = (productionItemId) => {
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          return {
            ...item,
            ingredients: [
              ...item.ingredients,
              {
                id: Date.now(),
                type: "raw_material", // Explicitly set type for new ingredients
                product: null,
                quantity: "",
                actualQty: "",
                unitOfMeasure: "",
                availableQty: 0,
              },
            ],
          };
        }
        return item;
      }),
    );
  };

  const removeIngredient = (productionItemId, ingredientId) => {
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          if (item.ingredients.length <= 1) {
            toast.error("At least one ingredient is required");
            return item;
          }
          return {
            ...item,
            ingredients: item.ingredients.filter(
              (ing) => ing.id !== ingredientId,
            ),
          };
        }
        return item;
      }),
    );
  };

  const handleIngredientChange = (
    productionItemId,
    ingredientId,
    field,
    value,
  ) => {
    setProductionItems((prev) =>
      prev.map((item) => {
        if (item.id === productionItemId) {
          const updatedIngredients = item.ingredients.map((ing) => {
            if (ing.id === ingredientId) {
              const updatedIngredient = { ...ing, [field]: value };

              if (field === "product" && value) {
                updatedIngredient.type = getIngredientTypeFromProduct(value);
                updatedIngredient.availableQty =
                  value.balance || value.stock_quantity || 0;
                updatedIngredient.unitOfMeasure = value.unit_of_measure || "";
                updatedIngredient.isOutOfWipStock = false;
                // Apply default_valuation_source: default_cost uses template rate; system_valuation uses WIP
                updatedIngredient.unit_cost = getSharedCostUnitCost(
                  ing.rate ?? ing.rate_amount ?? ing.unit_cost,
                  value,
                );
              }

              if (field === "quantity") {
                const availableQty = Number(ing.availableQty || 0);
                const sanitized = applyDecimalQtyBounds(value, {
                  min: 0,
                  max: availableQty > 0 ? availableQty : null,
                });
                const enteredQty = parseFloat(sanitized);
                if (
                  sanitized !== "" &&
                  !sanitized.endsWith(".") &&
                  Number.isFinite(enteredQty) &&
                  availableQty > 0 &&
                  enteredQty > availableQty
                ) {
                  toast.error(
                    `Quantity cannot exceed available balance of ${availableQty} ${
                      ing.unitOfMeasure || ""
                    }`,
                  );
                } else if (
                  sanitized !== "" &&
                  !sanitized.endsWith(".") &&
                  Number.isFinite(enteredQty) &&
                  enteredQty < 0
                ) {
                  toast.error("Quantity cannot be negative");
                }
                updatedIngredient.quantity = sanitized;
              }

              if (field === "actualQty") {
                const availableQty = Number(ing.availableQty || 0);
                const sanitized = applyDecimalQtyBounds(value, {
                  min: 0,
                  max: availableQty > 0 ? availableQty : null,
                });
                const enteredQty = parseFloat(sanitized);

                if (
                  sanitized !== "" &&
                  !sanitized.endsWith(".") &&
                  Number.isFinite(enteredQty) &&
                  availableQty > 0 &&
                  enteredQty > availableQty
                ) {
                  toast.error(
                    `Actual qty cannot exceed available balance of ${availableQty} ${
                      ing.unitOfMeasure || ""
                    }`,
                  );
                } else if (
                  sanitized !== "" &&
                  !sanitized.endsWith(".") &&
                  Number.isFinite(enteredQty) &&
                  enteredQty < 0
                ) {
                  toast.error("Actual qty cannot be negative");
                }
                updatedIngredient.actualQty = sanitized;
              }

              return updatedIngredient;
            }
            return ing;
          });

          return {
            ...item,
            ingredients: updatedIngredients,
          };
        }
        return item;
      }),
    );
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = {};
    const hasCostingTemplateForFinishedGood = (finishedGoodProduct) => {
      if (!finishedGoodProduct || !costingTemplates?.length) return false;
      const finishedGoodId = String(
        finishedGoodProduct.id ||
          finishedGoodProduct.product_id ||
          finishedGoodProduct.item_code ||
          "",
      );
      if (!finishedGoodId) return false;

      return costingTemplates.some((template) => {
        const templateProductId = String(
          template.finished_good_product_id || template.product_id || "",
        );
        if (!templateProductId) return false;
        if (templateProductId === finishedGoodId) return true;

        const templateNum = parseInt(templateProductId, 10);
        const finishedNum = parseInt(finishedGoodId, 10);
        return (
          !isNaN(templateNum) &&
          !isNaN(finishedNum) &&
          templateNum === finishedNum
        );
      });
    };

    // Form-level required fields
    if (!form.productionDate) {
      toast.error("Production Date is required");
      newErrors.productionDate = "Production Date is required";
      isValid = false;
    } else {
      const selectedDate = moment(form.productionDate, "YYYY-MM-DD", true);
      const today = moment().startOf("day");

      if (!selectedDate.isValid()) {
        toast.error("Please select a valid Production Date");
        newErrors.productionDate = "Please select a valid Production Date";
        isValid = false;
      } else if (selectedDate.isAfter(today)) {
        toast.error("Production Date cannot be in the future");
        newErrors.productionDate = "Production Date cannot be in the future";
        isValid = false;
      } else if (selectedDate.isBefore(today.clone().subtract(3, "years"))) {
        toast.error("Production Date cannot be older than 3 years");
        newErrors.productionDate =
          "Production Date cannot be older than 3 years";
        isValid = false;
      }
    }

    if (!form.notes || !form.notes.trim()) {
      toast.error("Notes/Comments are required");
      newErrors.notes = "Notes/Comments are required";
      isValid = false;
    }

    if (!productionItems || productionItems.length === 0) {
      toast.error("At least one production item is required");
      isValid = false;
    }

    for (const item of productionItems) {
      // Ensure at least one finished good and one raw material per production item
      if (!item.finishedGoods || item.finishedGoods.length === 0) {
        toast.error(
          "Each production item must have at least one finished good",
        );
        isValid = false;
      }
      // Allow submit without ingredients when selected finished good(s) have no costing template.
      const hasTemplateForAnyFinishedGood = (item.finishedGoods || []).some(
        (fg) => hasCostingTemplateForFinishedGood(fg.finishedGood),
      );
      const allowWithoutIngredients = !hasTemplateForAnyFinishedGood;

      // Check that ingredients array exists (it may contain all types)
      if (
        !allowWithoutIngredients &&
        (!item.ingredients || item.ingredients.length === 0)
      ) {
        toast.error("Each production item must have at least one ingredient");
        isValid = false;
      }

      for (const finishedGood of item.finishedGoods) {
        // Parse quantity value (handle both formatted and numeric)
        const quantityValue =
          typeof finishedGood.quantity === "string"
            ? parseFloat(parseNumberFromFormatted(finishedGood.quantity)) || 0
            : parseFloat(finishedGood.quantity) || 0;

        if (!finishedGood.finishedGood || !finishedGood.quantity) {
          toast.error(
            "Finished Goods: select an item and provide a quantity greater than 0",
          );
          isValid = false;
        }
        const operatorEntries =
          Array.isArray(finishedGood.operatorEntries) &&
          finishedGood.operatorEntries.length
            ? finishedGood.operatorEntries
            : null;
        if (operatorEntries) {
          const named = operatorEntries.filter((e) =>
            String(e.operator || "").trim(),
          );
          if (!named.length) {
            toast.error("Add at least one operator with a name selected");
            isValid = false;
          }
          for (const entry of named) {
            if (
              Number(entry.goodQuantity || 0) < 0 ||
              Number(entry.wasteQuantity || 0) < 0
            ) {
              toast.error("Operator Good Qty and Waste Qty cannot be negative");
              isValid = false;
              break;
            }
            if (
              Number(entry.wasteQuantity || 0) > 0 &&
              !String(entry.wasteType || "").trim()
            ) {
              toast.error("Select Waste Type for each operator row with waste");
              isValid = false;
              break;
            }
            if (
              Number(entry.wasteQuantity || 0) > 0 &&
              String(entry.wasteType || "")
                .trim()
                .toLowerCase() === "recyclable" &&
              !(entry.wasteScrapByProductSelection?.length > 0)
            ) {
              toast.error(
                "Select Scrap / By-product for recyclable waste on each operator row",
              );
              isValid = false;
              break;
            }
            if (
              Number(entry.wasteQuantity || 0) > 0 &&
              String(entry.wasteType || "")
                .trim()
                .toLowerCase() === "abnormal" &&
              !(entry.wasteAbnormalLossExpenseSelection?.length > 0)
            ) {
              toast.error(
                "Select Abnormal Loss account from chart of accounts for each abnormal waste row",
              );
              isValid = false;
              break;
            }
          }
        } else if (!finishedGood.operator) {
          toast.error("Operator is required for finished goods");
          isValid = false;
        }
        if (
          finishedGood.expectedQty === "" ||
          Number(finishedGood.expectedQty) <= 0
        ) {
          toast.error(
            "Expected Quantity is required and must be greater than 0",
          );
          isValid = false;
        }
        if (
          finishedGood.goodQuantity === "" ||
          Number(finishedGood.goodQuantity) < 0
        ) {
          toast.error("Good Quantity is required and cannot be negative");
          isValid = false;
        }
        if (
          finishedGood.wasteQuantity === "" ||
          Number(finishedGood.wasteQuantity) < 0
        ) {
          toast.error("Waste Quantity is required and cannot be negative");
          isValid = false;
        }
        if (
          Number(finishedGood.wasteQuantity || 0) > 0 &&
          !String(finishedGood.wasteType || "").trim()
        ) {
          toast.error(
            "Waste Type is required when Waste Qty is greater than 0",
          );
          isValid = false;
        }
        if (
          Number(finishedGood.wasteQuantity || 0) > 0 &&
          String(finishedGood.wasteType || "")
            .trim()
            .toLowerCase() === "recyclable" &&
          !(finishedGood.wasteScrapByProductSelection?.length > 0)
        ) {
          toast.error(
            "Select a Scrap / By-product when Waste Type is Recyclable",
          );
          isValid = false;
        }
        if (
          Number(finishedGood.wasteQuantity || 0) > 0 &&
          String(finishedGood.wasteType || "")
            .trim()
            .toLowerCase() === "abnormal" &&
          !(finishedGood.wasteAbnormalLossExpenseSelection?.length > 0)
        ) {
          toast.error(
            "Select Abnormal Loss account when Waste Type is Abnormal",
          );
          isValid = false;
        }
        if (quantityValue <= 0) {
          toast.error("Quantity must be greater than 0 for finished goods");
          isValid = false;
        }
        const totalOutputValue =
          Number(finishedGood.goodQuantity || 0) +
          Number(finishedGood.wasteQuantity || 0);
        const previousOutputValue =
          Number(finishedGood.previousGoodQuantity || 0) +
          Number(finishedGood.previousWasteQuantity || 0);
        const cumulativeOutputValue = totalOutputValue + previousOutputValue;
        const expectedQtyValue = Number(finishedGood.expectedQty || 0);
        if (!String(finishedGood.sessionStartTime || "").trim()) {
          toast.error("Session Start Time is required for finished goods");
          isValid = false;
        }
        if (expectedQtyValue > 0 && cumulativeOutputValue > expectedQtyValue) {
          toast.error(
            `Total output (${cumulativeOutputValue.toFixed(
              4,
            )}) cannot be greater than Expected (${expectedQtyValue.toFixed(4)})`,
          );
          isValid = false;
        }
        if (
          expectedQtyValue > 0 &&
          totalOutputValue === expectedQtyValue &&
          !String(finishedGood.sessionEndTime || "").trim()
        ) {
          toast.error(
            "Session End Time is required when Good + Waste equals Expected Quantity",
          );
          isValid = false;
        }
        if (
          expectedQtyValue > 0 &&
          cumulativeOutputValue < expectedQtyValue &&
          !String(finishedGood.shortfallReason || "").trim()
        ) {
          toast.error(
            "Shortfall reason is required when output is below expected quantity",
          );
          isValid = false;
        }
        // Only require multiplier for process_costing
        if (
          activeBusiness?.costing_method === "process_costing" &&
          !finishedGood.multiplier
        ) {
          toast.error(
            `Multiplier is required for finished good: ${
              finishedGood.finishedGood?.item_name || "Unknown"
            }`,
          );
          isValid = false;
        }
        if (
          branchOptions.length > 0 &&
          !branchesLoading &&
          finishedGood.finishedGood &&
          (!finishedGood.branchLocationId ||
            finishedGood.branchLocationId === "" ||
            String(finishedGood.branchLocationId) === "0") &&
          !String(finishedGood.branch_id || "").trim()
        ) {
          toast.error(
            "Please select Warehouse for each finished good product",
          );
          isValid = false;
        }
      }

      if (!allowWithoutIngredients) {
        // Only validate raw_material ingredients (displayed in UI)
        // Other types (other, by_product_credit) are handled separately
        const rawMaterialIngredients = item.ingredients.filter((ing) =>
          isIngredientType(ing.type || "raw_material"),
        );

        for (const ingredient of rawMaterialIngredients) {
          if (!ingredient.product || !ingredient.quantity) {
            toast.error(
              "Raw Materials: select a raw material and provide a quantity greater than 0",
            );
            isValid = false;
          }
          if (Number(ingredient.quantity) <= 0) {
            toast.error("Quantity must be greater than 0 for ingredients");
            isValid = false;
          }

          const totalFinishedGoodsQty = getTotalIngredientOutputQty(
            item.finishedGoods,
          );

          const rawMaterialQty = parseFloat(ingredient.quantity || 0);
          const qtyUsed = totalFinishedGoodsQty * rawMaterialQty;
          const availableQty = parseFloat(ingredient.availableQty || 0);

          // Check if qty used exceeds available
          const actualQtyValue = parseFloat(ingredient.actualQty || qtyUsed);
          if (actualQtyValue > availableQty) {
            toast.error(
              `Insufficient quantity for ${
                ingredient.product?.item_name || "raw material"
              }: Actual Qty (${actualQtyValue.toFixed(
                4,
              )}) exceeds Available (${availableQty.toFixed(4)})`,
            );
            isValid = false;
          }
        }
      }
    }

    // Validate Shared Costs for joint_shared costing type
    if (costingType === "joint_shared") {
      const rawMaterialCosts = sharedCostsFromGroup.filter((cost) =>
        isIngredientType(cost.type),
      );

      for (const cost of rawMaterialCosts) {
        if (!cost.product && !cost.rawMaterialSku) {
          toast.error(
            "Shared Costs: select a raw material for all shared cost items",
          );
          isValid = false;
        }
        if (!cost.quantity || parseFloat(cost.quantity || 0) <= 0) {
          toast.error(
            "Shared Costs: quantity must be greater than 0 for raw materials",
          );
          isValid = false;
        }

        // Find the product to get available quantity
        const foundProduct = rawMaterialProducts.find(
          (rm) => String(rm.item_code) === String(cost.rawMaterialSku),
        );
        const selectedProduct = foundProduct || cost.product;

        if (selectedProduct) {
          const qtyUsed = getSharedCostActualTotal(cost);

          // Get available quantity
          const availableQty = parseFloat(
            selectedProduct.balance ||
              selectedProduct.quantity ||
              selectedProduct.qty ||
              selectedProduct.available_qty ||
              0,
          );

          // Check if qty used exceeds available
          if (qtyUsed > availableQty) {
            toast.error(
              `Shared Costs: Insufficient quantity for ${
                selectedProduct.item_name ||
                selectedProduct.name ||
                "raw material"
              }: Total qty (${qtyUsed.toFixed(4)}) exceeds Available (${availableQty.toFixed(4)})`,
            );
            isValid = false;
          }
        }
      }

      const jointWt = String(sharedJointWasteType || "")
        .trim()
        .toLowerCase();
      if (
        jointWt === "recyclable" &&
        !(sharedJointScrapByProductSelection?.length > 0)
      ) {
        toast.error(
          "Shared Costs: Select a Scrap / By-product when Waste Type is Recyclable",
        );
        isValid = false;
      }
      if (jointWt === "by_product") {
        if (!(sharedJointScrapByProductSelection?.length > 0)) {
          toast.error(
            "Shared Costs: Select a Scrap / By-product when Waste Type is By-Product",
          );
          isValid = false;
        }
        if (
          sharedJointScrapCost === "" ||
          sharedJointScrapCost === null ||
          sharedJointScrapCost === undefined
        ) {
          toast.error("Shared Costs: Cost is required for By-Product waste");
          isValid = false;
        } else if (Number.isNaN(parseFloat(sharedJointScrapCost))) {
          toast.error("Shared Costs: Cost must be a valid number");
          isValid = false;
        } else if (parseFloat(sharedJointScrapCost) < 0) {
          toast.error("Shared Costs: Cost cannot be negative");
          isValid = false;
        }
        if (
          sharedJointScrapQty === "" ||
          sharedJointScrapQty === null ||
          sharedJointScrapQty === undefined
        ) {
          toast.error("Shared Costs: Qty is required for By-Product waste");
          isValid = false;
        } else if (Number.isNaN(parseFloat(sharedJointScrapQty))) {
          toast.error("Shared Costs: Qty must be a valid number");
          isValid = false;
        } else if (parseFloat(sharedJointScrapQty) <= 0) {
          toast.error(
            "Shared Costs: Qty must be greater than 0 for By-Product waste",
          );
          isValid = false;
        }
      }

      if (
        branchOptions.length > 0 &&
        !branchesLoading &&
        selectedTemplateByProduct &&
        !getResolvedTemplateByProductBranchId()
      ) {
        toast.error(
          "Please select Warehouse for the template by-product",
        );
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setLoading(true);

    // Transform production items to match the desired JSON structure
    const transformedProducts = productionItems.map((productionItem) => {
      const firstFG = productionItem.finishedGoods[0];
      let productUnits = firstFG
        ? getFinishedGoodMultiplierValue(firstFG)
        : null;
      if (
        (productUnits == null || productUnits === 1) &&
        costingType === "joint_shared" &&
        selectedProductGroup
      ) {
        const parsedProducts = parseProductsFromNotes(
          selectedProductGroup.notes,
        );
        if (firstFG?.finishedGood) {
          const matchedProduct = parsedProducts.find(
            (p) =>
              p.productSku === firstFG.finishedGood.item_code ||
              p.productSku === firstFG.finishedGood.sku ||
              p.name === firstFG.finishedGood.item_name,
          );
          if (matchedProduct?.units != null) {
            productUnits = parseFloat(matchedProduct.units) || productUnits;
          }
        }
      }
      if (productUnits == null && firstFG) {
        productUnits = getFinishedGoodMultiplierValue(firstFG);
      }

      return {
        id: productionItem.id,
        engineName:
          productionItem.finishedGoods
            ?.flatMap((fg) => fg.operatorEntries || [])
            .map((e) => String(e.engineName || "").trim())
            .find(Boolean) ||
          productionItem.engineName ||
          productionItem.finishedGoods?.[0]?.finishedGood?.item_name ||
          "",
        units:
          productUnits != null
            ? productUnits
            : productionItem.finishedGoods[0]
              ? typeof productionItem.finishedGoods[0].quantity === "string"
                ? parseFloat(
                    parseNumberFromFormatted(
                      productionItem.finishedGoods[0].quantity,
                    ),
                  ) || 0
                : parseFloat(productionItem.finishedGoods[0].quantity) || 0
              : 0, // Always include units at product level
        finishedGoods: productionItem.finishedGoods.map((fg) => {
          // Parse quantity value (handle both formatted and numeric)
          const quantityValue =
            typeof fg.quantity === "string"
              ? parseFloat(parseNumberFromFormatted(fg.quantity)) || 0
              : parseFloat(fg.quantity) || 0;
          // Unit from template = Multiplier. Use fg.units when available.
          const multiplierVal = getFinishedGoodMultiplierValue(fg);

          return {
            id: fg.id,
            units: multiplierVal, // Unit from template = Multiplier
            finishedGood: fg.finishedGood,
            quantity: quantityValue,
            operator: fg.operator || "",
            operatorEntries: (
              Array.isArray(fg.operatorEntries) && fg.operatorEntries.length
                ? fg.operatorEntries
                : [
                    createOperatorEntry({
                      operator: fg.operator || "",
                      goodQuantity: fg.goodQuantity || "",
                      wasteQuantity: fg.wasteQuantity || "",
                    }),
                  ]
            ).map((e) => ({
              id: e.id,
              engineName: e.engineName || "",
              operator: e.operator || "",
              goodQuantity: parseFloat(e.goodQuantity || 0) || 0,
              wasteQuantity: parseFloat(e.wasteQuantity || 0) || 0,
              wasteType: e.wasteType || "",
              wasteReason: e.wasteReason || "",
              wasteScrapByProductSelection: e.wasteScrapByProductSelection || [],
              wasteAbnormalLossExpenseSelection:
                e.wasteAbnormalLossExpenseSelection || [],
              abnormal_loss_account_code:
                e.wasteAbnormalLossExpenseSelection?.[0]?.code != null &&
                String(e.wasteAbnormalLossExpenseSelection[0].code).trim() !==
                  ""
                  ? String(e.wasteAbnormalLossExpenseSelection[0].code).trim()
                  : null,
              abnormal_loss_account_name:
                e.wasteAbnormalLossExpenseSelection?.[0]?.name != null
                  ? String(e.wasteAbnormalLossExpenseSelection[0].name)
                  : null,
            })),
            recycledQuantity: parseFloat(fg.recycledQuantity || 0) || 0,
            expectedQty: parseFloat(fg.expectedQty || 0),
            goodQuantity:
              parseFloat(fg.previousGoodQuantity || 0) +
              parseFloat(fg.goodQuantity || 0),
            wasteQuantity:
              parseFloat(fg.previousWasteQuantity || 0) +
              parseFloat(fg.wasteQuantity || 0),
            wasteType: fg.wasteType || "",
            wasteReason: fg.wasteReason || "",
            wasteScrapByProductSelection: fg.wasteScrapByProductSelection || [],
            wasteAbnormalLossExpenseSelection:
              fg.wasteAbnormalLossExpenseSelection || [],
            abnormal_loss_account_code:
              fg.wasteAbnormalLossExpenseSelection?.[0]?.code != null &&
              String(fg.wasteAbnormalLossExpenseSelection[0].code).trim() !== ""
                ? String(fg.wasteAbnormalLossExpenseSelection[0].code).trim()
                : null,
            abnormal_loss_account_name:
              fg.wasteAbnormalLossExpenseSelection?.[0]?.name != null
                ? String(fg.wasteAbnormalLossExpenseSelection[0].name)
                : null,
            sessionStartTime: fg.sessionStartTime || null,
            sessionEndTime: fg.sessionEndTime || null,
            totalOutput:
              parseFloat(fg.previousGoodQuantity || 0) +
              parseFloat(fg.goodQuantity || 0) +
              parseFloat(fg.previousWasteQuantity || 0) +
              parseFloat(fg.wasteQuantity || 0),
            shortfallReason: fg.shortfallReason || "",
            engineName:
              (Array.isArray(fg.operatorEntries) &&
                fg.operatorEntries
                  .map((e) => String(e.engineName || "").trim())
                  .find(Boolean)) ||
              productionItem.engineName ||
              fg.finishedGood?.item_name ||
              "",
            yieldPct: fg.expectedQty
              ? (
                  ((parseFloat(fg.previousGoodQuantity || 0) +
                    parseFloat(fg.goodQuantity || 0)) /
                    parseFloat(fg.expectedQty)) *
                  100
                ).toFixed(2)
              : null,
            multiplier: fg.multiplier,
            multiplierValue: multiplierVal,
            batchNo: fg.batchNo || batchNo,
            warehouse: fg.warehouse || productionItem.warehouse || "",
            unitOfMeasure:
              fg.unitOfMeasure || fg.finishedGood?.unit_of_measure || "",
            unit: fg.unitOfMeasure || fg.finishedGood?.unit_of_measure || "", // Explicit unit field
            category: fg.category || "",
            branchLocationId: fg.branchLocationId ?? null,
            branch_id: fg.branch_id ?? "",
            branch_name: fg.branch_name ?? "",
          };
        }),
        // Save ALL ingredient types (raw_material, other, by_product_credit) with all fields
        // Filter out invalid ingredients (e.g., those without required fields)
        ingredients: productionItem.ingredients
          .filter((ing) => {
            const ingType =
              ing.type || getIngredientTypeFromProduct(ing.product);

            // For ingredient types, must have product and quantity
            if (isIngredientType(ingType)) {
              return (
                ing.product &&
                ing.quantity &&
                Number(ing.quantity) > 0 &&
                Number(ing.actualQty || 0) >= 0
              );
            }

            // For other types, must have descriptionCode and either rate or quantity (for percentage)
            if (ingType === "other" || ingType === "by_product_credit") {
              // Must have descriptionCode to be valid
              if (!ing.descriptionCode && !ing.description_code) {
                return false;
              }
              // For rate-based, must have rate; for percentage-based, must have quantity
              const otherType = ing.other_type || "rate";
              if (otherType === "rate") {
                return ing.rate && Number(ing.rate) > 0;
              } else if (otherType === "percentage") {
                return ing.quantity && Number(ing.quantity) > 0;
              }
              return true;
            }

            return true;
          })
          .map((ing) => {
            const ingType =
              ing.type || getIngredientTypeFromProduct(ing.product);

            const totalFinishedGoodsQty = getTotalIngredientOutputQty(
              productionItem.finishedGoods,
            );

            let qtyUsed = 0;
            let expectedQty = 0;
            if (isIngredientType(ingType)) {
              const rawMaterialQty = parseFloat(ing.quantity || 0);
              expectedQty = getIngredientExpectedQty(
                productionItem.finishedGoods,
                rawMaterialQty,
              );
              qtyUsed = parseFloat(ing.actualQty || expectedQty);
            }

            const baseIngredient = {
              id: ing.id,
              type: ingType, // Preserve type
              quantity: ing.quantity,
              actualQty: ing.actualQty || "",
              unitOfMeasure: ing.unitOfMeasure || "",
              availableQty: ing.availableQty || 0,
              qtyUsed: qtyUsed, // Add qtyUsed for ingredient types
              expectedQty,
            };

            // For ingredient types, include product and unit_cost
            if (isIngredientType(ingType)) {
              const unitCost =
                parseFloat(ing.unit_cost) ||
                parseFloat(ing.product?.unit_cost) ||
                parseFloat(ing.product?.cost_price) ||
                0;
              return {
                ...baseIngredient,
                product: ing.product,
                unit_cost: unitCost,
              };
            } else {
              // For other types (other, by_product_credit), include description/account fields
              return {
                ...baseIngredient,
                product: ing.product || null, // May be null for other types
                description: ing.description || "",
                descriptionCode:
                  ing.descriptionCode || ing.description_code || "",
                account_head: ing.account_head || "",
                other_type: ing.other_type || "rate",
                rate: ing.rate || "",
                percentage_basis: ing.percentage_basis || "",
                amount: ing.amount || 0, // Include calculated amount
              };
            }
          }),
      };
    });

    // Format shared costs for JSON output
    console.log("=== SHARED COSTS DEBUG ===");
    console.log(
      "sharedCostsFromGroup before formatting:",
      JSON.stringify(sharedCostsFromGroup, null, 2),
    );
    console.log("sharedCostsFromGroup length:", sharedCostsFromGroup.length);

    // Format shared costs for JSON output - NO FILTERING, preserve ALL types (raw_material, other, by_product_credit)
    const formattedSharedCosts = sharedCostsFromGroup.map((cost) => {
      // Calculate qtyUsed for ingredient types: sharedCostQtyUse * quantity
      const qtyUsed = isIngredientType(cost.type)
        ? getSharedCostActualTotal(cost)
        : 0;

      // Apply default_valuation_source at save time: default_cost uses template rate; system_valuation uses WIP unit_cost
      const unitCost = isIngredientType(cost.type)
        ? getSharedCostUnitCost(
            cost.rate ?? cost.rate_amount,
            cost.product || undefined,
          )
        : undefined;

      return {
        type: cost.type, // Preserve type: raw_material, other, or by_product_credit
        description: cost.description || "",
        descriptionCode: cost.description_code || cost.descriptionCode || "",
        accountHead: cost.account_head || cost.accountHead || "",
        quantity: parseFloat(cost.quantity || 0),
        expectedQuantity: parseFloat(
          cost.expectedQuantity ?? cost.quantity ?? 0,
        ),
        actualQty: qtyUsed,
        expected_qty: getSharedCostExpectedTotal(cost),
        actual_qty: qtyUsed,
        qtyUsed: qtyUsed,
        ...(isIngredientType(cost.type) && { unit_cost: unitCost }),
        rawMaterialId: cost.rawMaterialId || cost.raw_material_id || "",
        rawMaterialName: cost.rawMaterialName || cost.raw_material_name || "",
        rawMaterialSku: cost.rawMaterialSku || cost.raw_material_sku || "",
        otherType: cost.other_type || cost.otherType || "",
        rate: cost.rate ? String(cost.rate) : "", // Keep as string
        percentageBasis: cost.percentage_basis || cost.percentageBasis || "",
      };
    });

    console.log(
      "formattedSharedCosts:",
      JSON.stringify(formattedSharedCosts, null, 2),
    );
    console.log("formattedSharedCosts length:", formattedSharedCosts.length);
    console.log("=== END SHARED COSTS DEBUG ===");

    const hasPartialRun = productionItems.some((item) =>
      item.finishedGoods.some((fg) => {
        const expected = parseFloat(fg.expectedQty || 0);
        const currentOutput =
          parseFloat(fg.goodQuantity || 0) + parseFloat(fg.wasteQuantity || 0);
        const previousOutput =
          parseFloat(fg.previousGoodQuantity || 0) +
          parseFloat(fg.previousWasteQuantity || 0);
        return expected > 0 && previousOutput + currentOutput < expected;
      }),
    );
    const shortfallReasons = productionItems
      .flatMap((item) => item.finishedGoods || [])
      .filter((fg) => {
        const expected = parseFloat(fg.expectedQty || 0);
        const currentOutput =
          parseFloat(fg.goodQuantity || 0) + parseFloat(fg.wasteQuantity || 0);
        const previousOutput =
          parseFloat(fg.previousGoodQuantity || 0) +
          parseFloat(fg.previousWasteQuantity || 0);
        return expected > 0 && previousOutput + currentOutput < expected;
      })
      .map((fg) => String(fg.shortfallReason || "").trim())
      .filter(Boolean);
    const totalGoodQty = productionItems.reduce(
      (sum, item) =>
        sum +
        item.finishedGoods.reduce(
          (inner, fg) => inner + (parseFloat(fg.goodQuantity || 0) || 0),
          0,
        ),
      0,
    );
    const totalBrokenQty = productionItems.reduce(
      (sum, item) =>
        sum +
        item.finishedGoods.reduce(
          (inner, fg) => inner + (parseFloat(fg.wasteQuantity || 0) || 0),
          0,
        ),
      0,
    );
    const finishedGoodsForSession = productionItems.flatMap(
      (item) => item.finishedGoods || [],
    );
    const sessionStartCandidates = finishedGoodsForSession
      .map((fg) => fg.sessionStartTime)
      .filter(Boolean);
    const sessionEndCandidates = finishedGoodsForSession
      .map((fg) => fg.sessionEndTime)
      .filter(Boolean);
    const nowIso = new Date().toISOString();
    const primarySessionStart = sessionStartCandidates[0] || nowIso;
    const primarySessionEnd =
      sessionEndCandidates.length > 0
        ? sessionEndCandidates.sort(
            (a, b) => new Date(b).getTime() - new Date(a).getTime(),
          )[0]
        : null;
    const historyDraft = [...sessionHistory];
    if (isResumeMode && historyDraft.length > 0) {
      const lastSessionIndex = [...historyDraft]
        .map((entry, index) => ({ entry, index }))
        .reverse()
        .find(({ entry }) => entry?.type === "session")?.index;

      if (lastSessionIndex !== undefined) {
        const lastSession = historyDraft[lastSessionIndex];
        if (lastSession?.status === "in_progress" && !lastSession?.endTime) {
          historyDraft[lastSessionIndex] = {
            ...lastSession,
            status: "done",
            endTime: primarySessionStart,
          };
          historyDraft.push({
            type: "interruption",
            at: primarySessionStart,
            reason: shortfallReasons[0] || form.notes || "Interruption logged",
          });
        }
      }
    }

    const nextSessionHistory = [
      ...historyDraft,
      {
        type: "session",
        label: `Session ${historyDraft.filter((entry) => entry?.type === "session").length + 1}`,
        startTime: primarySessionStart,
        endTime: hasPartialRun ? null : primarySessionEnd || nowIso,
        goodQty: totalGoodQty,
        brokenQty: totalBrokenQty,
        status: hasPartialRun ? "in_progress" : "done",
        shortfallReasons,
        notes: form.notes || "",
      },
    ];

    const totalExpectedQty = productionItems.reduce(
      (sum, item) =>
        sum +
        (item.finishedGoods || []).reduce(
          (inner, fg) => inner + (parseFloat(fg.expectedQty) || 0),
          0,
        ),
      0,
    );
    const runMetrics = {
      goodQty: totalGoodQty,
      wasteQty: totalBrokenQty,
      expectedQty: totalExpectedQty,
      yieldPct:
        totalExpectedQty > 0
          ? parseFloat(((totalGoodQty / totalExpectedQty) * 100).toFixed(2))
          : null,
    };

    // Build request data with proper structure for joint_shared
    let requestData = {
      batchNo: batchNo,
      facilityId: activeBusiness.id,
      productionDate: form.productionDate,
      productionLine: form.productionLine,
      notes: form.notes,
      costingType: costingType,
      createdBy: user.id,
      finishedGoodsCode: activeBusiness.finished_goods_code,
      wipCode: activeBusiness.wip,
      sharedCostQtyUse: sharedCostQtyUse || 1, // Qty use multiplier for shared costs
      runStatus: hasPartialRun ? "partial" : "complete",
      sessionHistory: nextSessionHistory,
      runMetrics,
      abnormal_loss_account: (() => {
        for (const item of productionItems) {
          for (const fg of item.finishedGoods || []) {
            const entries =
              Array.isArray(fg.operatorEntries) && fg.operatorEntries.length
                ? fg.operatorEntries
                : [fg];
            for (const row of entries) {
              const wt = String(row.wasteType || "")
                .trim()
                .toLowerCase();
              const code =
                row.wasteAbnormalLossExpenseSelection?.[0]?.code != null &&
                String(row.wasteAbnormalLossExpenseSelection[0].code).trim() !==
                  ""
                  ? String(row.wasteAbnormalLossExpenseSelection[0].code).trim()
                  : "";
              if (wt === "abnormal" && code) return code;
            }
            const fgWt = String(fg.wasteType || "")
              .trim()
              .toLowerCase();
            const fgCode =
              fg.wasteAbnormalLossExpenseSelection?.[0]?.code != null &&
              String(fg.wasteAbnormalLossExpenseSelection[0].code).trim() !== ""
                ? String(fg.wasteAbnormalLossExpenseSelection[0].code).trim()
                : "";
            if (fgWt === "abnormal" && fgCode) return fgCode;
          }
        }
        return (
          getResolvedPostingAccountDisplay(
            "abnormal_loss_account",
            "Abnormal Loss",
          ).code || null
        );
      })(),
    };

    // For joint_shared, structure data as shown in the JSON example
    if (costingType === "joint_shared") {
      console.log("=== JOINT_SHARED DEBUG ===");
      console.log(
        "productionItems (RAW DATA):",
        JSON.stringify(productionItems, null, 2),
      );
      console.log("productionItems count:", productionItems.length);

      // Log ingredients for each production item
      productionItems.forEach((item, idx) => {
        const productName =
          item.finishedGoods[0]?.finishedGood?.item_name ||
          `Product ${idx + 1}`;
        console.log(
          `[${productName}] Ingredients (${item.ingredients.length} total):`,
          JSON.stringify(item.ingredients, null, 2),
        );
        console.log(
          `[${productName}] Ingredient types:`,
          item.ingredients.map((ing) => ing.type),
        );
      });
      // Transform products to match expected format: { productId, productName, productSku, units, items }
      // Transform directly from productionItems to preserve ALL ingredient fields before any filtering
      const transformedProductsForJointShared = productionItems.map(
        (productionItem) => {
          const firstFinishedGood = productionItem.finishedGoods[0];
          const finishedGoodProduct = firstFinishedGood?.finishedGood || null;

          // Get units (= Multiplier) — user-editable multiplierValue wins over template
          let productUnits = firstFinishedGood
            ? getFinishedGoodMultiplierValue(firstFinishedGood)
            : null;
          if (productUnits == null && selectedProductGroup) {
            const parsedProducts = parseProductsFromNotes(
              selectedProductGroup.notes,
            );
            if (finishedGoodProduct) {
              const matchedProduct = parsedProducts.find(
                (p) =>
                  p.productSku === finishedGoodProduct.item_code ||
                  p.productSku === finishedGoodProduct.sku ||
                  p.name === finishedGoodProduct.item_name,
              );
              if (matchedProduct?.units != null) {
                productUnits = parseFloat(matchedProduct.units) || productUnits;
              }
            }
          }

          // Transform ALL ingredients (raw_material, other, by_product_credit) to items format
          // Include ALL ingredients - don't filter, preserve all types with all fields
          console.log(
            `[${finishedGoodProduct?.item_name}] Transforming ${productionItem.ingredients.length} ingredients for joint_shared save:`,
            productionItem.ingredients.map((ing) => ({
              type: ing.type,
              description: ing.description || ing.product?.item_name,
              descriptionCode: ing.descriptionCode,
            })),
          );

          console.log(
            `[${finishedGoodProduct?.item_name}] productionItem.ingredients before transformation:`,
            productionItem.ingredients,
          );
          console.log(
            `[${finishedGoodProduct?.item_name}] Ingredient types:`,
            productionItem.ingredients.map((ing) => ing.type),
          );

          // Transform ALL ingredients to items format - NO FILTERING, preserve ALL types
          // Map every ingredient in productionItem.ingredients to items array
          const items = productionItem.ingredients.map((ing) => {
            const ingType = ing.type || "raw_material";
            const otherType = ing.other_type || ing.otherType || "rate";

            // For ingredient types
            if (isIngredientType(ingType)) {
              const rawMaterialQty = parseFloat(ing.quantity || 0);
              const expectedQty = getIngredientExpectedQty(
                productionItem.finishedGoods,
                rawMaterialQty,
              );
              const qtyUsed = parseFloat(ing.actualQty || expectedQty);
              // Apply default_valuation_source: default_cost uses template rate; system_valuation uses WIP unit_cost
              const unitCost = getSharedCostUnitCost(
                ing.rate ?? ing.rate_amount ?? ing.unit_cost,
                ing.product || undefined,
              );

              return {
                type: ingType || "raw_material",
                description: ing.product?.item_name || ing.description || "",
                descriptionCode:
                  ing.descriptionCode || ing.description_code || "",
                accountHead: ing.account_head || ing.accountHead || "",
                quantity: rawMaterialQty,
                expectedQty,
                expected_qty: expectedQty,
                actualQty: ing.actualQty || "",
                actual_qty:
                  ing.actualQty != null && String(ing.actualQty).trim() !== ""
                    ? parseFloat(ing.actualQty)
                    : null,
                qtyUsed,
                unit_cost: unitCost,
                rawMaterialId:
                  ing.product?.product_id ||
                  ing.product?.item_code ||
                  ing.product?.sku ||
                  "",
                rawMaterialName: ing.product?.item_name || "",
                rawMaterialSku:
                  ing.product?.sku || ing.product?.item_code || "",
                otherType: "",
                rate: "",
                percentageBasis: "",
              };
            } else {
              // For other types (other, by_product_credit)
              return {
                type: ingType, // Preserve type (other or by_product_credit)
                description: ing.description || "",
                descriptionCode:
                  ing.descriptionCode || ing.description_code || "",
                accountHead: ing.account_head || ing.accountHead || "",
                quantity: parseFloat(ing.quantity || 0), // Can be 0 for rate-based items
                rawMaterialId: "",
                rawMaterialName: "",
                rawMaterialSku: "",
                otherType: otherType,
                rate: ing.rate ? String(ing.rate) : "", // Keep as string to match expected format
                percentageBasis:
                  ing.percentage_basis || ing.percentageBasis || "",
              };
            }
          });

          console.log(
            `[${finishedGoodProduct?.item_name}] Transformed items:`,
            items,
          );
          console.log(
            `[${finishedGoodProduct?.item_name}] Items count by type:`,
            {
              ingredient_types: items.filter((i) => isIngredientType(i.type))
                .length,
              other: items.filter((i) => i.type === "other").length,
              by_product_credit: items.filter(
                (i) => i.type === "by_product_credit",
              ).length,
            },
          );

          // Get finished goods quantity (similar to Markup.jsx)
          // Calculate from first finished good quantity (matching JSON example where productQty = finished goods qty)
          // productQty MUST be the actual finished goods quantity entered by user (not template units)
          // This is the value the user enters in the Quantity field in the UI
          const finishedGoodsQuantity = firstFinishedGood
            ? getNumericQuantity(firstFinishedGood.quantity)
            : 0;

          // Debug: Log the values to verify
          console.log(
            `[${finishedGoodProduct?.item_name}] productQty calculation:`,
            {
              finishedGoodQuantity: firstFinishedGood?.quantity,
              finishedGoodsQuantity: finishedGoodsQuantity,
              productUnits: productUnits,
              productQtyValue: finishedGoodsQuantity,
            },
          );

          // productQty should ALWAYS use the finished goods quantity (user-entered value from UI)
          // NEVER use productUnits (template value) for productQty - only for units field
          // This matches the pattern in Markup.jsx where productQty = actual quantity produced
          const productQtyValue = finishedGoodsQuantity; // Always use user-entered quantity, no fallback

          const finishedGoodsPayload = (productionItem.finishedGoods || []).map(
            (fg) => {
              const quantityValue =
                typeof fg.quantity === "string"
                  ? parseFloat(parseNumberFromFormatted(fg.quantity)) || 0
                  : parseFloat(fg.quantity) || 0;
              const multiplierVal = getFinishedGoodMultiplierValue(fg);
              const goodCumulative =
                parseFloat(fg.previousGoodQuantity || 0) +
                parseFloat(fg.goodQuantity || 0);
              const wasteCumulative =
                parseFloat(fg.previousWasteQuantity || 0) +
                parseFloat(fg.wasteQuantity || 0);
              const fgProduct = fg.finishedGood || null;
              return {
                id: fg.id,
                finishedGood: fgProduct
                  ? {
                      id: fgProduct.id || fgProduct.product_id,
                      product_id: fgProduct.product_id || fgProduct.id,
                      item_code: fgProduct.item_code || fgProduct.sku,
                      sku: fgProduct.sku || fgProduct.item_code,
                      item_name: fgProduct.item_name || fgProduct.name,
                      unit_of_measure: fgProduct.unit_of_measure || "",
                      category: fgProduct.category || "",
                    }
                  : null,
                productId: fgProduct?.id || fgProduct?.product_id || null,
                productSku: fgProduct?.item_code || fgProduct?.sku || null,
                productName: fgProduct?.item_name || fgProduct?.name || null,
                quantity: quantityValue,
                units: multiplierVal,
                expectedQty: parseFloat(fg.expectedQty || 0),
                goodQuantity: goodCumulative,
                wasteQuantity: wasteCumulative,
                wasteType: fg.wasteType || "",
                wasteReason: fg.wasteReason || "",
                wasteScrapByProductSelection:
                  fg.wasteScrapByProductSelection || [],
                wasteAbnormalLossExpenseSelection:
                  fg.wasteAbnormalLossExpenseSelection || [],
                abnormal_loss_account_code:
                  fg.wasteAbnormalLossExpenseSelection?.[0]?.code != null &&
                  String(
                    fg.wasteAbnormalLossExpenseSelection[0].code,
                  ).trim() !== ""
                    ? String(
                        fg.wasteAbnormalLossExpenseSelection[0].code,
                      ).trim()
                    : null,
                abnormal_loss_account_name:
                  fg.wasteAbnormalLossExpenseSelection?.[0]?.name != null
                    ? String(fg.wasteAbnormalLossExpenseSelection[0].name)
                    : null,
                yieldPct: fg.expectedQty
                  ? parseFloat(
                      (
                        (goodCumulative / parseFloat(fg.expectedQty)) *
                        100
                      ).toFixed(2),
                    )
                  : null,
                multiplierValue: multiplierVal,
                unitOfMeasure:
                  fg.unitOfMeasure || fgProduct?.unit_of_measure || "",
                branchLocationId: fg.branchLocationId ?? null,
                branch_id: fg.branch_id ?? "",
                branch_name: fg.branch_name ?? "",
              };
            },
          );

          return {
            productId:
              finishedGoodProduct?.id ||
              finishedGoodProduct?.product_id ||
              finishedGoodProduct?.chart_code ||
              null,
            engineName:
              productionItem.engineName || finishedGoodProduct?.item_name || "",
            productName: finishedGoodProduct?.item_name || "",
            productSku:
              finishedGoodProduct?.item_code || finishedGoodProduct?.sku || "",
            productQty: productQtyValue, // Finished Goods Quantity - ALWAYS use actual user-entered quantity from UI
            units:
              productUnits ||
              getFinishedGoodMultiplierValue(firstFinishedGood) ||
              1,
            branchLocationId: firstFinishedGood?.branchLocationId ?? null,
            branch_id: firstFinishedGood?.branch_id ?? "",
            branch_name: firstFinishedGood?.branch_name ?? "",
            items: items, // All ingredient types (raw_material, other, by_product_credit) with all fields
            finishedGoods: finishedGoodsPayload,
          };
        },
      );

      console.log(
        "transformedProductsForJointShared (FINAL DATA):",
        JSON.stringify(transformedProductsForJointShared, null, 2),
      );
      console.log("=== END JOINT_SHARED DEBUG ===");

      const scrapJoint = sharedJointScrapByProductSelection?.[0] || null;
      const jointWtSubmit = String(sharedJointWasteType || "")
        .trim()
        .toLowerCase();
      const sharedJointWastePayload = {
        wasteQuantity: 0,
        wasteType: String(sharedJointWasteType || "").trim(),
        scrapProduct: scrapJoint
          ? {
              id: scrapJoint.id,
              product_id: scrapJoint.product_id || scrapJoint.id,
              item_name: scrapJoint.item_name || scrapJoint.name || "",
              sku: scrapJoint.sku || scrapJoint.item_code || "",
              item_code: scrapJoint.item_code || scrapJoint.sku || "",
              inventory_account: scrapJoint.inventory_account || "",
              ...(jointWtSubmit === "by_product"
                ? {
                    cost: parseFloat(sharedJointScrapCost) || 0,
                    quantity: parseFloat(sharedJointScrapQty) || 0,
                  }
                : {}),
            }
          : null,
      };

      const templateByProductPayload = buildTemplateByProductPayload();
      requestData = {
        ...requestData,
        costingType: "joint_shared",
        output: sharedCostOutputPercentage || 1,
        qtyUse: sharedCostQtyUse || 1, // Qty use multiplier for shared costs
        sharedCosts: formattedSharedCosts, // Use plural 'sharedCosts' to match expected API format
        products: transformedProductsForJointShared,
        sharedJointWaste: sharedJointWastePayload,
        ...(templateByProductPayload
          ? { templateByProduct: templateByProductPayload }
          : {}),
      };
    } else {
      // For job_specific, keep original structure
      requestData.productionItems = transformedProducts;
    }

    _postApi(
      "/api/production/manufacturing-records",
      requestData,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          toast.success(
            resp.data.message || "Production recorded successfully",
          );
          navigate("/app/production/record-production");
        } else {
          toast.error(resp.message || "Failed to record production");
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Error recording production");
      },
    );
  };

  const formatSessionRange = (startTime, endTime) => {
    if (!startTime) return "N/A";
    const start = moment(startTime);
    const end = endTime ? moment(endTime) : null;
    if (!start.isValid()) return "N/A";
    return `${start.format("HH:mm")} - ${end && end.isValid() ? end.format("HH:mm") : "in progress"}`;
  };

  return (
    <div className="min-h-screen bg-white p-2">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: "#4267B2" }}
            >
              <Factory className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Record Manufacturing Production
              </h1>
              <p className="text-gray-600 mt-1">
                {costingType === "joint_shared"
                  ? "Joint / Shared Cost Allocation - Manage shared costs and finished goods"
                  : "Job / Specific Costing - Manage finished goods and raw materials for production"}
              </p>
            </div>
          </div>
        </div>
        {/* Production Details Card */}
        <div className="bg-white rounded-xl mb-8 border border-gray-200 shadow-sm overflow-hidden">
          {/* Card header bar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: "#4267B2", color: "white" }}
            >
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-gray-800 tracking-wide uppercase">
              Production Details
            </h2>
          </div>

          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Production Date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Production Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="productionDate"
                value={form.productionDate}
                onChange={handleFormChange}
                min={moment().subtract(3, "years").format("YYYY-MM-DD")}
                max={moment().format("YYYY-MM-DD")}
                className={`h-10 w-full px-3 border rounded-lg text-sm outline-none transition-colors ${
                  errors.productionDate
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white focus:border-blue-500"
                }`}
              />
              {errors.productionDate && (
                <p className="text-red-500 text-xs">{errors.productionDate}</p>
              )}
            </div>

            {/* Batch Number */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                Batch Number
              </label>
              <input
                type="text"
                value={batchNo}
                disabled
                className="h-10 w-full px-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm font-semibold"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Notes / Comments <span className="text-red-500">*</span>
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleFormChange}
                placeholder="Add notes..."
                rows="2"
                className={`w-full px-3 py-2 border rounded-lg text-sm outline-none resize-none transition-colors ${
                  errors.notes
                    ? "border-red-400 bg-red-50"
                    : "border-gray-300 bg-white focus:border-blue-500"
                }`}
                required
              />
              {errors.notes && (
                <p className="text-red-500 text-xs">{errors.notes}</p>
              )}
            </div>
          </div>
          {isResumeMode && resumeSessionHistory && (
            <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-2 bg-amber-100 border-b border-amber-200">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Session History
                </h4>
                <div className="flex items-center gap-3 text-xs text-amber-700">
                  <span>
                    Batch:{" "}
                    <span className="font-mono font-bold">
                      {resumeSessionHistory.batchId}
                    </span>
                  </span>
                  <span>
                    Last saved:{" "}
                    {resumeSessionHistory.createdAt
                      ? moment(resumeSessionHistory.createdAt).format(
                          "DD MMM YYYY HH:mm",
                        )
                      : "N/A"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${resumeSessionHistory.runStatus === "partial" ? "bg-orange-200 text-orange-800" : "bg-green-200 text-green-800"}`}
                  >
                    {resumeSessionHistory.runStatus}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-amber-100">
                {Array.isArray(sessionHistory) && sessionHistory.length > 0
                  ? sessionHistory.map((entry, idx) => {
                      if (entry?.type === "interruption") {
                        return (
                          <div
                            key={`interrupt-${idx}`}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50"
                          >
                            <span className="text-xs font-bold text-red-600 uppercase">
                              Interruption
                            </span>
                            <span className="text-xs text-red-700">
                              {entry.at ? moment(entry.at).format("HH:mm") : ""}
                            </span>
                            <span className="text-xs text-red-600">
                              — {entry.reason || "Logged"}
                            </span>
                          </div>
                        );
                      }
                      const isDone = entry.status === "done";
                      return (
                        <div
                          key={`session-${idx}`}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2"
                        >
                          <span className="text-xs font-bold text-amber-900">
                            {entry.label || `Session ${idx + 1}`}
                          </span>
                          <span className="text-xs text-gray-600">
                            {formatSessionRange(entry.startTime, entry.endTime)}
                          </span>
                          <span className="text-xs text-green-700 font-semibold">
                            +{Number(entry.goodQty || 0).toFixed(2)} good
                          </span>
                          <span className="text-xs text-red-600 font-semibold">
                            +{Number(entry.brokenQty || 0).toFixed(2)} broken
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isDone ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}
                          >
                            {isDone ? "Done" : "In progress"}
                          </span>
                          {Array.isArray(entry.shortfallReasons) &&
                            entry.shortfallReasons.length > 0 && (
                              <span className="text-xs text-orange-700 italic">
                                Reason: {entry.shortfallReasons.join(", ")}
                              </span>
                            )}
                        </div>
                      );
                    })
                  : (resumeSessionHistory.items || []).map((product, idx) => {
                      const prevFg = product.finishedGoods?.[0] || {};
                      const prevGood = parseFloat(prevFg.goodQuantity || 0);
                      const prevWaste = parseFloat(prevFg.wasteQuantity || 0);
                      const expected = parseFloat(prevFg.expectedQty || 0);
                      const remainingQty = Math.max(
                        expected - (prevGood + prevWaste),
                        0,
                      );
                      return (
                        <div
                          key={`${product.id || idx}-resume`}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2"
                        >
                          <span className="text-xs font-semibold text-amber-900">
                            {prevFg.finishedGood?.item_name ||
                              product.productName ||
                              `Product ${idx + 1}`}
                          </span>
                          <span className="text-xs text-gray-600">
                            Expected: {expected.toFixed(2)}
                          </span>
                          <span className="text-xs text-green-700">
                            Produced: {(prevGood + prevWaste).toFixed(2)}
                          </span>
                          <span className="text-xs text-orange-700">
                            Remaining: {remainingQty.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}
        </div>
        {/* {JSON.stringify(rawMaterialProducts)} */}
        {/* Shared Costs + Template By-Product — single card for joint_shared */}
        {costingType === "joint_shared" && (
          <div className="mb-8 bg-white rounded-lg border border-green-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Package className="text-green-600 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    Shared Costs &amp; By-Product
                    <span className="text-green-700 font-semibold">
                      {" "}
                      (Raw Materials Only)
                    </span>
                  </h2>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Shared raw materials and by-product template lines for this
                    production
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-b from-green-50/40 to-white">
              <div className="grid grid-cols-12 gap-6 mb-4">
                <div className="group col-span-12 md:col-span-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expected Shared Costing Template{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-green-500"
                    onChange={(e) => handleProductGroupChange(e.target.value)}
                    value={selectedProductGroup?.id ?? ""}
                  >
                    <option value="">
                      Select expected template...
                    </option>
                    {productGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.products?.length || 0} products)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group col-span-12 md:col-span-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Actual Shared Costing Template
                  </label>
                  <select
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg transition-all outline-none focus:border-green-500"
                    onChange={(e) =>
                      handleActualProductGroupChange(e.target.value)
                    }
                    value={selectedActualProductGroup?.id ?? ""}
                    disabled={!selectedProductGroup}
                  >
                    <option value="">
                      Select actual template...
                    </option>
                    {productGroups.map((group) => (
                      <option key={`actual-${group.id}`} value={group.id}>
                        {group.name} ({group.products?.length || 0} products)
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Defaults to the expected template. Choose another to load
                    actual raw-material quantities.
                  </p>
                </div>
              </div>

              {selectedProductGroup && (
                <>
                  {/* Shared raw materials (first in card) */}
                  {(() => {
                    const rawMaterialCosts = sharedCostsFromGroup.filter(
                      (cost) => isIngredientType(cost.type),
                    );

                    return (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-green-100">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900">
                              Shared raw materials
                            </h4>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Enter the actual quantity used per raw material.
                              Recipe qty is from the template for reference.
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center gap-1.5">
                                <label
                                  htmlFor="production-shared-qty-used"
                                  className="text-xs font-medium text-gray-700 whitespace-nowrap"
                                >
                                  Scale factor
                                </label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex text-gray-400 hover:text-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 rounded"
                                      aria-label="About scale factor for shared raw materials"
                                    >
                                      <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    className="max-w-[280px] p-2.5 text-left text-xs leading-snug font-normal"
                                  >
                                    <p className="font-semibold mb-1">
                                      Auto from actual usage
                                    </p>
                                    <p>
                                      Total actual raw material qty ÷ total
                                      recipe qty (e.g. 300 ÷ 100 = 3). Scales
                                      other shared costs (rates). Raw material
                                      cost always uses the actual qty per line.
                                      Falls back to finished-good output when no
                                      recipe quantities exist.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                                <Input
                                  id="production-shared-qty-used"
                                  type="number"
                                  value={sharedCostQtyUse}
                                  readOnly
                                  disabled
                                  className="min-w-[7.5rem] w-32 h-8 text-sm text-center px-2 tabular-nums bg-gray-50 text-gray-600"
                                  aria-label="Scale factor from production output (read only)"
                                />
                              </div>
                            </TooltipProvider>
                            <Badge className="bg-green-100 text-green-700">
                              {rawMaterialCosts.length} item(s)
                            </Badge>
                            <UIButton
                              size="sm"
                              className="text-xs bg-green-600 text-white hover:bg-green-700"
                              onClick={() =>
                                handleAddSharedCost("raw_material")
                              }
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Raw Material
                            </UIButton>
                          </div>
                        </div>

                        <div className="overflow-x-auto border border-green-100 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-green-50">
                              <tr>
                                <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase w-24">
                                  Type
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                                  Account / Product
                                </th>
                                <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                                  Description
                                </th>
                                <th className="px-2  py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                  Recipe Qty
                                </th>
                                <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                  Actual Qty Used
                                </th>
                                <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {rawMaterialCosts.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-4 py-8 text-center text-gray-500"
                                  >
                                    <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                    <p>
                                      No raw materials added yet. Click
                                      &quot;Add Raw Material&quot; to add.
                                    </p>
                                  </td>
                                </tr>
                              ) : (
                                (() => {
                                  // Pre-calculate raw materials total (only from displayed items)
                                  const rawMaterialsTotal =
                                    rawMaterialCosts.reduce(
                                      (sum, c) =>
                                        sum +
                                        parseFloat(c.quantity || 0) *
                                          parseFloat(c.unit_cost || 0),
                                      0,
                                    );

                                  return rawMaterialCosts.map((cost, costIdx) => {
                                    const selectedProduct = cost.product || null;

                                    const recipeQty = getSharedCostRecipeQty(cost);
                                    const suggestedTotal =
                                      getSharedCostExpectedTotal(cost);
                                    const qtyUsed = getSharedCostActualTotal(cost);

                                    // Get available quantity
                                    const availableQty = selectedProduct
                                      ? parseFloat(
                                          selectedProduct.balance ||
                                            selectedProduct.quantity ||
                                            selectedProduct.qty ||
                                            selectedProduct.available_qty ||
                                            0,
                                        )
                                      : 0;

                                    // Check if qty used exceeds available
                                    const isInsufficient =
                                      qtyUsed > availableQty;

                                    return (
                                      <tr
                                        key={cost.id}
                                        className={
                                          isInsufficient
                                            ? "bg-red-50 hover:bg-red-100"
                                            : "bg-green-50 hover:bg-green-100"
                                        }
                                      >
                                        {/* Type - Fixed as Raw Material */}
                                        <td className="px-1 py-2 align-middle">
                                          <span className="text-xs border rounded px-1 py-0.5 font-medium w-20 bg-green-100 text-green-700 border-green-200 inline-block">
                                            Raw Mat.
                                          </span>
                                        </td>

                                        {/* Account / Product - Only raw materials */}
                                        <td className="px-2 py-2 align-top">
                                          <div>
                                            <Select
                                              id={`shared-cost-product-${cost.id}`}
                                              options={sharedRawMaterialSelectOptions
                                                .filter((product) => {
                                                  const itemType =
                                                    product.item_type ||
                                                    product.type ||
                                                    "";
                                                  return (
                                                    itemType
                                                      .toLowerCase()
                                                      .includes(
                                                        "raw material",
                                                      ) ||
                                                    itemType.toLowerCase() ===
                                                      "raw_material" ||
                                                    itemType === ""
                                                  );
                                                })
                                                .map((product) => ({
                                                  value: product,
                                                  label: `${
                                                    product.item_name ||
                                                    product.name ||
                                                    "N/A"
                                                  } (${
                                                    product.item_code ||
                                                    product.sku ||
                                                    "N/A"
                                                  }) - Avail: ${parseFloat(
                                                    product.balance ||
                                                      product.quantity ||
                                                      product.qty ||
                                                      product.available_qty ||
                                                      0,
                                                  ).toFixed(4)}`,
                                                }))}
                                              placeholder="Select raw material..."
                                              isClearable
                                              menuPlacement="top"
                                              value={
                                                selectedProduct
                                                  ? {
                                                      value: selectedProduct,
                                                      label: `${
                                                        selectedProduct.item_name ||
                                                        selectedProduct.name ||
                                                        "N/A"
                                                      } (${
                                                        selectedProduct.item_code ||
                                                        selectedProduct.sku ||
                                                        "N/A"
                                                      }) - Avail: ${parseFloat(
                                                        selectedProduct.balance ||
                                                          selectedProduct.quantity ||
                                                          selectedProduct.qty ||
                                                          selectedProduct.available_qty ||
                                                          0,
                                                      ).toFixed(4)}`,
                                                    }
                                                  : null
                                              }
                                              onChange={(selected) => {
                                                handleUpdateSharedCost(
                                                  cost.id,
                                                  "product",
                                                  selected
                                                    ? selected.value
                                                    : null,
                                                );
                                              }}
                                              styles={{
                                                control: (provided, state) => ({
                                                  ...provided,
                                                  minHeight: "38px",
                                                  borderColor: state.isFocused
                                                    ? "#3b82f6"
                                                    : "#d1d5db",
                                                  borderWidth: "1px",
                                                  borderRadius: "0.5rem",
                                                  boxShadow: state.isFocused
                                                    ? "0 0 0 3px rgb(59 130 246 / 0.1)"
                                                    : "none",
                                                  fontSize: "14px",
                                                  "&:hover": {
                                                    borderColor: state.isFocused
                                                      ? "#3b82f6"
                                                      : "#d1d5db",
                                                  },
                                                }),
                                                menu: (provided) => ({
                                                  ...provided,
                                                  zIndex: 9999,
                                                  marginBottom: "0.25rem",
                                                }),
                                                menuPortal: (provided) => ({
                                                  ...provided,
                                                  zIndex: 9999,
                                                }),
                                              }}
                                              menuPortalTarget={document.body}
                                            />
                                            {selectedProduct && (
                                              <p className="mt-1 text-xs text-gray-600">
                                                {isInsufficient ? (
                                                  <span className="text-red-700 font-semibold">
                                                    ⚠ Qty used (
                                                    {qtyUsed.toFixed(4)})
                                                    exceeds available (
                                                    {availableQty.toFixed(4)})
                                                  </span>
                                                ) : availableQty >= qtyUsed &&
                                                  qtyUsed > 0 ? (
                                                  <span className="text-green-700 font-semibold">
                                                    ✓ Available:{" "}
                                                    {availableQty.toFixed(4)}{" "}
                                                    (Qty used:{" "}
                                                    {qtyUsed.toFixed(4)})
                                                  </span>
                                                ) : null}
                                              </p>
                                            )}
                                          </div>
                                        </td>

                                        {/* Description */}
                                        <td className="px-2 py-2 align-middle">
                                          <Input
                                            type="text"
                                            value={cost.description || ""}
                                            onChange={(e) =>
                                              handleUpdateSharedCost(
                                                cost.id,
                                                "description",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Description"
                                            className="text-sm w-full"
                                          />
                                        </td>

                                        {/* Recipe Qty — from costing template (read-only) */}
                                        <td className="px-2 py-2 text-center align-middle">
                                          <Input
                                            type="number"
                                            value={
                                              recipeQty > 0
                                                ? recipeQty
                                                : cost.quantity || ""
                                            }
                                            placeholder="Recipe"
                                            min="0"
                                            step="0.01"
                                            className="text-center text-sm w-24 bg-gray-50 text-gray-600 cursor-not-allowed"
                                            readOnly
                                            disabled
                                          />
                                          {Math.abs(
                                            parseFloat(sharedCostQtyUse || 1) - 1,
                                          ) > 0.0001 &&
                                            recipeQty > 0 && (
                                              <p className="mt-1 text-[10px] text-gray-500">
                                                Suggested:{" "}
                                                {suggestedTotal.toFixed(4)}
                                              </p>
                                            )}
                                        </td>

                                        {/* Actual Qty Used — what was consumed this batch */}
                                        <td className="px-2 py-2 text-center align-middle">
                                          <div className="flex flex-col items-center gap-1">
                                            <Input
                                              type="text"
                                              inputMode="decimal"
                                              value={
                                                cost.actualQty !== undefined &&
                                                cost.actualQty !== null &&
                                                cost.actualQty !== ""
                                                  ? formatNumberWithCommas(
                                                      String(cost.actualQty),
                                                    )
                                                  : ""
                                              }
                                              onChange={(e) => {
                                                handleUpdateSharedCost(
                                                  cost.id,
                                                  "actualQty",
                                                  sanitizeDecimalQtyInput(
                                                    e.target.value,
                                                  ),
                                                );
                                              }}
                                              placeholder="0.0000"
                                              autoFocus={
                                                costIdx === 0 &&
                                                !parseFloat(cost.actualQty || 0)
                                              }
                                              className={`text-right text-sm w-full ${
                                                isInsufficient
                                                  ? "border-red-400 bg-red-50"
                                                  : !parseFloat(cost.actualQty || 0)
                                                    ? "border-red-400 bg-red-50 text-red-600 font-semibold"
                                                    : ""
                                              }`}
                                            />
                                            {isInsufficient && (
                                              <span className="text-xs text-red-600 font-semibold">
                                                ⚠ Insufficient
                                              </span>
                                            )}
                                            {!isInsufficient &&
                                              availableQty >= qtyUsed &&
                                              qtyUsed > 0 && (
                                                <span className="text-xs text-green-600 font-semibold">
                                                  ✓ Available
                                                </span>
                                              )}
                                          </div>
                                        </td>

                                        {/* Amount */}
                                        {/* <td className="px-2 py-2 text-right align-middle text-sm font-semibold text-gray-700">
                                          {formatNumber(
                                            (
                                              parseFloat(cost.quantity || 0) *
                                              parseFloat(cost.unit_cost || 0)
                                            ).toFixed(2)
                                          )}
                                        </td> */}

                                        {/* Action */}
                                        <td className="px-2 py-2 text-center align-middle">
                                          <button
                                            onClick={() =>
                                              handleRemoveSharedCost(cost.id)
                                            }
                                            className="text-red-600 hover:text-red-700 transition-colors"
                                            title="Remove cost item"
                                          >
                                            <Trash2 size={18} />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  });
                                })()
                              )}

                              {/* Totals Row - Calculate using all cost types but only show if raw materials exist */}
                              {/* {rawMaterialCosts.length > 0 && (
                                <tr className="bg-green-100 font-bold">
                                  <td
                                    colSpan={4}
                                    className="px-4 py-2 text-right text-sm text-green-800"
                                  >
                                    TOTAL SHARED COSTS:
                                  </td>
                                  <td className="px-4 py-2 text-right text-sm text-green-800">
                                    ₦
                                    {formatNumber(
                                      (() => {
                                        // Pre-calculate raw materials total
                                        const rawMaterialsTotal =
                                          sharedCostsFromGroup
                                            .filter(
                                              (c) => isIngredientType(c.type)
                                            )
                                            .reduce(
                                              (sum, c) =>
                                                sum +
                                                parseFloat(c.quantity || 0) *
                                                  parseFloat(c.unit_cost || 0),
                                              0
                                            );

                                        // Calculate total with proper running totals
                                        let grandTotal = rawMaterialsTotal;

                                        sharedCostsFromGroup.forEach((cost) => {
                                          const costType =
                                            cost.type || "raw_material";
                                          const inputType =
                                            cost.other_type || "rate";

                                          if (isIngredientType(costType)) {
                                            // Already included in rawMaterialsTotal
                                            return;
                                          }

                                          let amount = 0;
                                          if (inputType === "rate") {
                                            amount = parseFloat(cost.rate || 0);
                                          } else if (
                                            inputType === "percentage"
                                          ) {
                                            const pct = parseFloat(
                                              cost.quantity || 0
                                            );
                                            const basis =
                                              cost.percentage_basis ||
                                              "raw_material";
                                            if (basis === "raw_material") {
                                              amount =
                                                (pct / 100) * rawMaterialsTotal;
                                            } else if (basis === "all_items") {
                                              amount = (pct / 100) * grandTotal;
                                            }
                                          }

                                          if (
                                            costType === "by_product_credit"
                                          ) {
                                            grandTotal -= amount;
                                          } else {
                                            grandTotal += amount;
                                          }
                                        });

                                        return grandTotal.toFixed(2);
                                      })()
                                    )}
                                  </td>
                                  <td className="px-2 py-2"></td>
                                </tr>
                              )} */}
                              {/* {rawMaterialCosts.length > 0 && (
                                <tr className="bg-green-100 font-bold">
                                  <td
                                    colSpan={4}
                                    className="px-4 py-2 text-right text-sm text-green-800"
                                  >
                                    <div className="flex items-center justify-end gap-2">
                                      <span>Output </span>
                                      <input
                                        type="number"
                                        value={sharedCostOutputPercentage}
                                        onChange={(e) =>
                                          setSharedCostOutputPercentage(
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        min="0"
                                        step="0.01"
                                        className="w-20 px-2 py-1 text-center border border-green-300 rounded text-sm font-semibold"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-right text-sm text-green-800">
                                    ₦
                                    {formatNumber(
                                      (() => {
                                        // Pre-calculate raw materials total
                                        const rawMaterialsTotal =
                                          sharedCostsFromGroup
                                            .filter(
                                              (c) => isIngredientType(c.type)
                                            )
                                            .reduce(
                                              (sum, c) =>
                                                sum +
                                                parseFloat(c.quantity || 0) *
                                                  parseFloat(c.unit_cost || 0),
                                              0
                                            );

                                        // Calculate total with proper running totals (using ALL cost types from template)
                                        let grandTotal = rawMaterialsTotal;

                                        sharedCostsFromGroup.forEach((cost) => {
                                          const costType =
                                            cost.type || "raw_material";
                                          const inputType =
                                            cost.other_type || "rate";

                                          if (isIngredientType(costType)) {
                                            return;
                                          }

                                          let amount = 0;
                                          if (inputType === "rate") {
                                            amount = parseFloat(cost.rate || 0);
                                          } else if (
                                            inputType === "percentage"
                                          ) {
                                            const pct = parseFloat(
                                              cost.quantity || 0
                                            );
                                            const basis =
                                              cost.percentage_basis ||
                                              "raw_material";
                                            if (basis === "raw_material") {
                                              amount =
                                                (pct / 100) * rawMaterialsTotal;
                                            } else if (basis === "all_items") {
                                              amount = (pct / 100) * grandTotal;
                                            }
                                          }

                                          if (
                                            costType === "by_product_credit"
                                          ) {
                                            grandTotal -= amount;
                                          } else {
                                            grandTotal += amount;
                                          }
                                        });

                                        // Calculate: TOTAL SHARED COSTS / output
                                        const outputValue =
                                          sharedCostOutputPercentage || 1;
                                        const outputAmount =
                                          grandTotal / outputValue;
                                        return outputAmount.toFixed(2);
                                      })()
                                    )}
                                  </td>
                                  <td className="px-2 py-2"></td>
                                </tr>
                              )} */}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  <TemplateByProductSection
                    embedded
                    accent="green"
                    templateByProductOptions={templateByProductOptions}
                    selectedTemplateByProduct={selectedTemplateByProduct}
                    onSelectByProduct={(bp) => {
                      if (!bp) {
                        clearTemplateByProductState();
                        return;
                      }
                      const isDifferentProduct =
                        selectedTemplateByProduct &&
                        String(bp.id) !== String(selectedTemplateByProduct.id);
                      const isFirstSelect = !selectedTemplateByProduct;
                      setSelectedTemplateByProduct(bp);
                      setPendingTemplateByProductMeta(null);
                      if (isFirstSelect || isDifferentProduct) {
                        handleTemplateByProductQtyChange("1");
                        const bpCost = bp?.cost_price;
                        if (bpCost != null && bpCost !== "") {
                          setTemplateByProductUnitCost(String(bpCost));
                        } else {
                          setTemplateByProductUnitCost("");
                        }
                        setTemplateByProductItems([]);
                        setTemplateByProductBranchId(
                          getResolvedTemplateByProductBranchId(),
                        );
                      }
                    }}
                    onClear={clearTemplateByProductState}
                    templateByProductQty={templateByProductQty}
                    onQtyChange={handleTemplateByProductQtyChange}
                    templateByProductItems={templateByProductItems}
                    templateByProductUnitCost={templateByProductUnitCost}
                    onUnitCostChange={setTemplateByProductUnitCost}
                    rawMaterialProducts={rawMaterialProducts}
                    formatRmSelectLabel={formatRmSelectLabel}
                    onAddRawMaterial={handleAddTemplateByProductRawMaterial}
                    onRemoveItem={handleRemoveTemplateByProductItem}
                    onItemChange={handleTemplateByProductItemChange}
                    branchOptions={branchOptions}
                    branchesLoading={branchesLoading}
                    templateByProductBranchId={templateByProductBranchId}
                    onBranchLocationIdChange={setTemplateByProductBranchId}
                  />
                </>
              )}
              {/* Display Raw Materials from Product Specific Items */}
              {selectedProductGroup &&
                (() => {
                  const parsedProducts = parseProductsFromNotes(
                    selectedProductGroup.notes,
                  );
                  const allProductRawMaterials = parsedProducts.flatMap(
                    (product) =>
                      product.items
                        .filter((item) => isIngredientType(item.type))
                        .map((item) => ({
                          ...item,
                          productName: product.name,
                          productSku: product.sku,
                        })),
                  );

                  return null;
                })()}
            </div>
          </div>
        )}
        {/* Production Items */}
        <div className="space-y-6">
          {/* <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Package className="text-indigo-600 w-5 h-5" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Production Items
              </h2>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                {productionItems.length}
              </span>
            </div>
            <button
              onClick={addProductionItem}
              className="flex items-center gap-2 px-4 py-2 bg-[#4267B2] text-white rounded-lg hover:bg-blue-600 transition-all font-semibold text-sm"
            >
              <Plus size={14} />
              Add Production Item
            </button>
          </div> */}

          {/* Production Items List */}
          {productionItems.map((productionItem, index) => (
            <div
              key={productionItem.id}
              className="bg-white rounded-lg overflow-hidden border border-gray-200"
            >
              {/* Item Header */}
              <div
                onClick={() =>
                  setExpandedItem(
                    expandedItem === productionItem.id
                      ? null
                      : productionItem.id,
                  )
                }
                className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors border-b border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#4267B2] rounded-lg flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">
                        Finished Goods{" "}
                        <span className="text-green-600">
                          (Output Products) #{index + 1}
                        </span>
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Products produced from this production item{" "}
                        {productionItem.finishedGoods.length} finished good(s) •{" "}
                        {productionItem.ingredients.length} ingredient(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {productionItems.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProductionItem(productionItem.id);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={25} />
                      </button>
                    )}
                    <div className="text-gray-400">
                      {expandedItem === productionItem.id ? "▼" : "▶"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Item Content */}
              {expandedItem === productionItem.id ? (
                <div className="p-2 space-y-8">
                  {/* Finished Goods Section */}

                  {/* Finished Goods Content */}
                  <div className="p-2">
                    <div className="space-y-4">
                      {productionItem.finishedGoods.map((finishedGood) => {
                        const showFgMultiplier =
                          activeBusiness?.costing_method !==
                            "process_costing" &&
                          (costingType === "joint_shared" ||
                            activeBusiness?.costing_method ===
                              "job_product_costing");

                        return (
                          <div
                            key={finishedGood.id}
                            className="rounded-xl border border-gray-200 bg-white p-3 transition-colors"
                          >
                            <div className="space-y-5">
                              {/* Product + Branch */}
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                              {/* Product + Branch */}
                              <div className="lg:col-span-7 flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Product{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  {(() => {
                                    // Check if finishedGood.finishedGood exists in finishedGoodProducts
                                    const existsInList =
                                      finishedGood.finishedGood &&
                                      finishedGoodProducts.some(
                                        (p) =>
                                          p.item_code ===
                                            finishedGood.finishedGood
                                              .item_code ||
                                          p.sku ===
                                            finishedGood.finishedGood.sku ||
                                          p.id === finishedGood.finishedGood.id,
                                      );
                                    // If not in list, add it to options
                                    const typeaheadOptions =
                                      !existsInList && finishedGood.finishedGood
                                        ? [
                                            finishedGood.finishedGood,
                                            ...finishedGoodProducts,
                                          ]
                                        : finishedGoodProducts;

                                    return (
                                      <Typeahead
                                        id={`finished-good-product-${productionItem.id}-${finishedGood.id}`}
                                        options={typeaheadOptions}
                                        labelKey={(product) =>
                                          `${product.item_name}${
                                            product.item_code
                                              ? ` (${product.item_code})`
                                              : ""
                                          }${
                                            product.unit_of_measure
                                              ? ` - ${product.unit_of_measure}`
                                              : ""
                                          }`
                                        }
                                        placeholder="Select finished good..."
                                        onChange={(selected) => {
                                          const selectedProduct =
                                            selected[0] || null;
                                          handleFinishedGoodChange(
                                            productionItem.id,
                                            finishedGood.id,
                                            "finishedGood",
                                            selectedProduct,
                                          );
                                        }}
                                        selected={
                                          finishedGood.finishedGood
                                            ? [finishedGood.finishedGood]
                                            : []
                                        }
                                        className="!text-sm !mx-0"
                                      />
                                    );
                                  })()}
                                  <p className="mt-1 text-xs text-gray-500">
                                    Unit:{" "}
                                    <span className="font-semibold text-indigo-600">
                                      {finishedGood.unitOfMeasure ||
                                        finishedGood.finishedGood
                                          ?.unit_of_measure ||
                                        "N/A"}
                                    </span>
                                  </p>
                                </div>
                                {(branchesLoading ||
                                  branchOptions.length > 0) && (
                                  <div className="w-full sm:w-64 shrink-0">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                      Warehouse{" "}
                                      {!branchesLoading && (
                                        <span className="text-red-500">*</span>
                                      )}
                                    </label>
                                    {branchesLoading ? (
                                      <Skeleton className="h-[38px] w-full rounded-lg" />
                                    ) : (
                                      <select
                                        value={resolveDefaultBranchLocationId(
                                          finishedGood.branchLocationId,
                                          branchOptions,
                                        )}
                                        onChange={(e) =>
                                          handleFinishedGoodBranchChange(
                                            productionItem.id,
                                            finishedGood.id,
                                            e.target.value,
                                          )
                                        }
                                        className="w-full h-10 px-2 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white"
                                      >
                                        {branchOptions.map((b) => (
                                          <option
                                            key={b.id}
                                            value={String(b.id)}
                                          >
                                            {b.storeName ||
                                              b.branch_name ||
                                              b.branch_id}
                                            {b.state ? ` — ${b.state}` : ""}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                )}
                              </div>

                              {showFgMultiplier && (
                                <div className="lg:col-span-2">
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Multiplier / Value
                                  </label>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      finishedGood.multiplierValue != null &&
                                      finishedGood.multiplierValue !== ""
                                        ? formatNumberWithCommas(
                                            String(
                                              finishedGood.multiplierValue ??
                                                finishedGood.units ??
                                                "",
                                            ),
                                          )
                                        : finishedGood.units != null
                                          ? formatNumberWithCommas(
                                              String(finishedGood.units),
                                            )
                                          : ""
                                    }
                                    onChange={(e) =>
                                      handleFinishedGoodChange(
                                        productionItem.id,
                                        finishedGood.id,
                                        "multiplierValue",
                                        sanitizeDecimalQtyInput(e.target.value),
                                      )
                                    }
                                    placeholder="1.0"
                                    className="h-10 w-full text-center border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 tabular-nums"
                                  />
                                  <p className="text-xs text-indigo-600 mt-1 tabular-nums">
                                    {formatNumber(
                                      parseFloat(
                                        finishedGood.goodQuantity || 0,
                                      ).toFixed(2),
                                    )}{" "}
                                    ×{" "}
                                    {formatNumber(
                                      getFinishedGoodMultiplierValue(
                                        finishedGood,
                                      ).toFixed(2),
                                    )}{" "}
                                    ={" "}
                                    <span className="font-semibold">
                                      {formatNumber(
                                        (
                                          parseFloat(
                                            finishedGood.goodQuantity || 0,
                                          ) *
                                          getFinishedGoodMultiplierValue(
                                            finishedGood,
                                          )
                                        ).toFixed(2),
                                      )}
                                    </span>
                                  </p>
                                </div>
                              )}

                              <div className={showFgMultiplier ? "lg:col-span-3" : "lg:col-span-5"}>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                  Expected Qty{" "}
                                  <span className="text-red-500">*</span>
                                </label>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  value={
                                    finishedGood.expectedQty !== undefined &&
                                    finishedGood.expectedQty !== null &&
                                    finishedGood.expectedQty !== ""
                                      ? formatNumberWithCommas(
                                          String(finishedGood.expectedQty),
                                        )
                                      : ""
                                  }
                                  onChange={(e) => {
                                    handleFinishedGoodChange(
                                      productionItem.id,
                                      finishedGood.id,
                                      "expectedQty",
                                      sanitizeDecimalQtyInput(e.target.value),
                                    );
                                  }}
                                  placeholder="0.0000"
                                  className="h-10 w-full text-center border-2 border-indigo-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 font-semibold tabular-nums"
                                />
                                {(() => {
                                  const expected = parseFloat(
                                    finishedGood.expectedQty || 0,
                                  );
                                  const used =
                                    (parseFloat(finishedGood.goodQuantity || 0) ||
                                      0) +
                                    (parseFloat(finishedGood.wasteQuantity || 0) ||
                                      0);
                                  const remaining = Math.max(expected - used, 0);
                                  const over = expected > 0 && used > expected;
                                  if (!(expected > 0)) {
                                    return (
                                      <p className="text-xs text-amber-700 mt-1">
                                        Enter Expected Qty first — operator Good/Waste
                                        are limited to this total.
                                      </p>
                                    );
                                  }
                                  return (
                                    <p className="text-xs mt-1">
                                      <span
                                        className={
                                          over
                                            ? "text-red-700 font-semibold"
                                            : "text-indigo-700"
                                        }
                                      >
                                        Used: {used.toFixed(4)} / {expected.toFixed(4)}
                                      </span>
                                      <span className="text-gray-400 mx-1.5">•</span>
                                      <span
                                        className={
                                          remaining > 0
                                            ? "text-emerald-700"
                                            : "text-gray-600"
                                        }
                                      >
                                        Remaining: {remaining.toFixed(4)}
                                      </span>
                                    </p>
                                  );
                                })()}
                              </div>
                              </div>

                              {/* Session times */}
                              {(() => {
                                const fgExpected = Number(finishedGood.expectedQty || 0);
                                const fgGood = Number(finishedGood.goodQuantity || 0);
                                const fgWaste = Number(finishedGood.wasteQuantity || 0);
                                const showSessionEndTime =
                                  fgExpected > 0 && fgGood + fgWaste === fgExpected;
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                                        Session Start Time{" "}
                                        <span className="text-red-500">*</span>
                                      </label>
                                      <Input
                                        type="datetime-local"
                                        value={
                                          finishedGood.sessionStartTime
                                            ? moment(finishedGood.sessionStartTime).format(
                                                "YYYY-MM-DDTHH:mm",
                                              )
                                            : ""
                                        }
                                        onChange={(e) =>
                                          handleFinishedGoodChange(
                                            productionItem.id,
                                            finishedGood.id,
                                            "sessionStartTime",
                                            e.target.value
                                              ? moment(
                                                  e.target.value,
                                                  "YYYY-MM-DDTHH:mm",
                                                ).toISOString()
                                              : "",
                                          )
                                        }
                                        className="h-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                                        Session End Time
                                        {showSessionEndTime ? (
                                          <span className="text-red-500">*</span>
                                        ) : null}
                                      </label>
                                      <Input
                                        type="datetime-local"
                                        disabled={!showSessionEndTime}
                                        value={
                                          finishedGood.sessionEndTime
                                            ? moment(finishedGood.sessionEndTime).format(
                                                "YYYY-MM-DDTHH:mm",
                                              )
                                            : ""
                                        }
                                        onChange={(e) =>
                                          handleFinishedGoodChange(
                                            productionItem.id,
                                            finishedGood.id,
                                            "sessionEndTime",
                                            e.target.value
                                              ? moment(
                                                  e.target.value,
                                                  "YYYY-MM-DDTHH:mm",
                                                ).toISOString()
                                              : "",
                                          )
                                        }
                                        className="h-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                                      />
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Qty stat cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Good Qty *
                                  </p>
                                  <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                                    {finishedGood.goodQuantity || "0"}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    Total of operator good qty
                                  </p>
                                </div>
                                <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
                                    Waste Qty *
                                  </p>
                                  <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-950">
                                    {finishedGood.wasteQuantity || "0"}
                                  </p>
                                  <p className="mt-0.5 text-xs text-amber-800/70">
                                    Total of operator waste qty
                                  </p>
                                </div>
                                <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/80">
                                    Recycled Qty
                                  </p>
                                  <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-950">
                                    {finishedGood.recycledQuantity != null
                                      ? finishedGood.recycledQuantity
                                      : sumOperatorEntries(
                                          finishedGood.operatorEntries,
                                        ).recycled}
                                  </p>
                                  <p className="mt-0.5 text-xs text-sky-800/70">
                                    Recyclable waste total
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                  <h5 className="text-sm font-semibold text-gray-800">
                                    Operator production{" "}
                                    <span className="text-red-500">*</span>
                                  </h5>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddOperatorEntry(
                                        productionItem.id,
                                        finishedGood.id,
                                      )
                                    }
                                    disabled={
                                      !Number(finishedGood.expectedQty || 0)
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#4267B2] text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add operator
                                  </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                  Good + Waste per row cannot exceed Expected Qty.
                                  Abnormal waste uses the chart of accounts (default
                                  Abnormal Loss). Recyclable requires a by-product.
                                </p>
                                <div className="overflow-x-auto overflow-y-visible rounded-md border border-slate-200 bg-white">
                                  <table className="w-full table-fixed text-sm min-w-[920px]">
                                    <colgroup>
                                      <col className="w-[14%]" />
                                      <col className="w-[12%]" />
                                      <col className="w-[9%]" />
                                      <col className="w-[9%]" />
                                      <col className="w-[12%]" />
                                      <col className="w-[22%]" />
                                      <col className="w-[8%]" />
                                    </colgroup>
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th className="px-2 py-2.5 text-left text-sm font-semibold text-gray-700">
                                          Engine Name
                                        </th>
                                        <th className="px-2 py-2.5 text-left text-sm font-semibold text-gray-700">
                                          Operator
                                        </th>
                                        <th className="px-2 py-2.5 text-center text-sm font-semibold text-gray-700">
                                          Good Qty
                                        </th>
                                        <th className="px-2 py-2.5 text-center text-sm font-semibold text-gray-700">
                                          Waste Qty
                                        </th>
                                        <th className="px-2 py-2.5 text-center text-sm font-semibold text-gray-700">
                                          Waste Type
                                        </th>
                                        <th className="px-2 py-2.5 text-left text-sm font-semibold text-gray-700">
                                          Loss account / By-product
                                        </th>
                                        <th className="px-2 py-2.5 text-center text-sm font-semibold text-gray-700">
                                          Action
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(Array.isArray(
                                        finishedGood.operatorEntries,
                                      ) && finishedGood.operatorEntries.length
                                        ? finishedGood.operatorEntries
                                        : [
                                            createOperatorEntry({
                                              engineName:
                                                productionItem.engineName ||
                                                finishedGood.finishedGood
                                                  ?.item_name ||
                                                "",
                                              operator:
                                                finishedGood.operator || "",
                                            }),
                                          ]
                                      ).map((entry, entryIdx) => {
                                        const opControlClass =
                                          "!h-10 w-full min-w-0 box-border border border-gray-300 rounded-md px-2 py-0 text-sm bg-white leading-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-none disabled:bg-gray-100 disabled:text-gray-400";
                                        const expectedSet =
                                          Number(finishedGood.expectedQty || 0) >
                                          0;
                                        const entryWaste =
                                          parseFloat(entry.wasteQuantity || 0) ||
                                          0;
                                        const entryWasteType = String(
                                          entry.wasteType || "",
                                        )
                                          .trim()
                                          .toLowerCase();
                                        const entryRecyclable =
                                          entryWasteType === "recyclable" ||
                                          entryWasteType === "recycled" ||
                                          entryWasteType === "recycle";
                                        const entryAbnormal =
                                          entryWasteType === "abnormal";
                                        return (
                                          <Fragment key={entry.id}>
                                            <tr className={`border-t border-gray-100 ${entryIdx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}`}>
                                              <td className="px-2 py-2 align-middle">
                                                <Input
                                                  type="text"
                                                  value={entry.engineName || ""}
                                                  placeholder="Engine name"
                                                  disabled={!expectedSet}
                                                  onChange={(e) =>
                                                    handleOperatorEntryChange(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      entry.id,
                                                      "engineName",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className={opControlClass}
                                                />
                                              </td>
                                              <td className="px-2 py-2 align-middle">
                                                <select
                                                  value={entry.operator || ""}
                                                  disabled={!expectedSet}
                                                  onChange={(e) =>
                                                    handleOperatorEntryChange(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      entry.id,
                                                      "operator",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className={opControlClass}
                                                >
                                                  <option value="">
                                                    Select operator
                                                  </option>
                                                  {operatorTeams.map((team) => (
                                                    <option
                                                      key={team.id}
                                                      value={team.teamName}
                                                    >
                                                      {team.teamName}
                                                    </option>
                                                  ))}
                                                </select>
                                              </td>
                                              <td className="px-2 py-2 align-middle">
                                                <Input
                                                  type="text"
                                                  inputMode="decimal"
                                                  disabled={!expectedSet}
                                                  value={
                                                    entry.goodQuantity !==
                                                      undefined &&
                                                    entry.goodQuantity !==
                                                      null &&
                                                    entry.goodQuantity !== ""
                                                      ? formatNumberWithCommas(
                                                          String(
                                                            entry.goodQuantity,
                                                          ),
                                                        )
                                                      : ""
                                                  }
                                                  placeholder="0.00"
                                                  onChange={(e) => {
                                                    handleOperatorEntryChange(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      entry.id,
                                                      "goodQuantity",
                                                      sanitizeDecimalQtyInput(
                                                        e.target.value,
                                                      ),
                                                    );
                                                  }}
                                                  className={`${opControlClass} text-right tabular-nums`}
                                                />
                                              </td>
                                              <td className="px-2 py-2 align-middle">
                                                <Input
                                                  type="text"
                                                  inputMode="decimal"
                                                  disabled={!expectedSet}
                                                  value={
                                                    entry.wasteQuantity !==
                                                      undefined &&
                                                    entry.wasteQuantity !==
                                                      null &&
                                                    entry.wasteQuantity !== ""
                                                      ? formatNumberWithCommas(
                                                          String(
                                                            entry.wasteQuantity,
                                                          ),
                                                        )
                                                      : ""
                                                  }
                                                  placeholder="0.00"
                                                  onChange={(e) => {
                                                    handleOperatorEntryChange(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      entry.id,
                                                      "wasteQuantity",
                                                      sanitizeDecimalQtyInput(
                                                        e.target.value,
                                                      ),
                                                    );
                                                  }}
                                                  className={`${opControlClass} text-right tabular-nums`}
                                                />
                                              </td>
                                              <td className="px-2 py-2 align-middle">
                                                <select
                                                  value={entry.wasteType || ""}
                                                  disabled={
                                                    !expectedSet ||
                                                    entryWaste <= 0
                                                  }
                                                  onChange={(e) =>
                                                    handleOperatorEntryChange(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      entry.id,
                                                      "wasteType",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className={`appearance-none !h-9 w-full min-w-0 cursor-pointer rounded-full border px-3 text-center text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${wasteTypePillClass(entry.wasteType)}`}
                                                >
                                                  <option value="">
                                                    {entryWaste > 0
                                                      ? "Select type"
                                                      : "—"}
                                                  </option>
                                                  <option value="normal">
                                                    Normal
                                                  </option>
                                                  <option value="abnormal">
                                                    Abnormal
                                                  </option>
                                                  <option value="recyclable">
                                                    Recyclable
                                                  </option>
                                                </select>
                                              </td>
                                              <td className="px-2 py-2 align-middle">
                                                {entryWaste > 0 &&
                                                entryAbnormal ? (
                                                  <div className="min-h-10 flex flex-col justify-center px-2 py-1 text-xs rounded-md border border-rose-300 bg-rose-50 text-rose-900">
                                                    <span className="font-semibold">
                                                      Abnormal loss account
                                                    </span>
                                                    <span className="truncate">
                                                      {entry
                                                        .wasteAbnormalLossExpenseSelection?.[0]
                                                        ?.name
                                                        ? `${entry.wasteAbnormalLossExpenseSelection[0].name}${
                                                            entry
                                                              .wasteAbnormalLossExpenseSelection[0]
                                                              .code
                                                              ? ` (${entry.wasteAbnormalLossExpenseSelection[0].code})`
                                                              : ""
                                                          }`
                                                        : "Select account below"}
                                                    </span>
                                                  </div>
                                                ) : entryWaste > 0 &&
                                                  entryRecyclable ? (
                                                  <div className="min-h-10 flex flex-col justify-center px-2 py-1 text-xs rounded-md border border-sky-300 bg-sky-50 text-sky-900">
                                                    <span className="font-semibold">
                                                      Recyclable
                                                    </span>
                                                    <span className="truncate">
                                                      {entry
                                                        .wasteScrapByProductSelection?.[0]
                                                        ?.item_name ||
                                                        entry
                                                          .wasteScrapByProductSelection?.[0]
                                                          ?.name ||
                                                        "Select by-product below"}
                                                    </span>
                                                  </div>
                                                ) : (
                                                  <div className="h-10 flex items-center px-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-md bg-gray-50">
                                                    {entryWaste > 0
                                                      ? entryWasteType ===
                                                        "normal"
                                                        ? "N/A for Normal"
                                                        : "Set Abnormal or Recyclable"
                                                      : "—"}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-2 py-2 align-middle text-center">
                                                <div className="flex h-10 items-center justify-center">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleRemoveOperatorEntry(
                                                        productionItem.id,
                                                        finishedGood.id,
                                                        entry.id,
                                                      )
                                                    }
                                                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    title="Remove operator row"
                                                  >
                                                    <Trash2 size={16} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                            {entryWaste > 0 && entryAbnormal && (
                                              <tr className="bg-rose-50/80 border-b border-rose-100">
                                                <td
                                                  colSpan={7}
                                                  className="px-3 py-3 overflow-visible"
                                                >
                                                  <div className="flex flex-col sm:flex-row sm:items-end gap-2 max-w-3xl">
                                                    <div className="flex-1 min-w-0 relative z-30">
                                                      <label className="block text-xs font-semibold text-rose-900 mb-1">
                                                        Abnormal loss account{" "}
                                                        <span className="text-red-500">
                                                          *
                                                        </span>
                                                      </label>
                                                      <Typeahead
                                                        id={`record-abnormal-coa-${finishedGood.id}-${entry.id}`}
                                                        options={
                                                          expenseList || []
                                                        }
                                                        labelKey={(o) =>
                                                          `${o.name || ""} (${o.code || ""})`
                                                        }
                                                        placeholder={
                                                          expenseList.length
                                                            ? "Search expense account…"
                                                            : "No expense accounts found"
                                                        }
                                                        disabled={!expectedSet}
                                                        selected={
                                                          entry.wasteAbnormalLossExpenseSelection ||
                                                          []
                                                        }
                                                        onChange={(sel) => {
                                                          handleOperatorEntryChange(
                                                            productionItem.id,
                                                            finishedGood.id,
                                                            entry.id,
                                                            "wasteAbnormalLossExpenseSelection",
                                                            sel || [],
                                                          );
                                                        }}
                                                        clearButton
                                                        positionFixed
                                                        flip
                                                        className="w-full"
                                                        inputProps={{
                                                          id: `record-abnormal-coa-input-${finishedGood.id}-${entry.id}`,
                                                          className:
                                                            "form-control h-10 text-sm border border-rose-400 rounded-md bg-white",
                                                        }}
                                                      />
                                                      <p className="text-[11px] text-rose-800/80 mt-1">
                                                        Required when waste type
                                                        is Abnormal. Defaults to
                                                        the facility Abnormal
                                                        Loss account from chart
                                                        of accounts.
                                                      </p>
                                                    </div>
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                            {entryWaste > 0 &&
                                              entryRecyclable && (
                                                <tr className="bg-sky-50/80 border-b border-sky-100">
                                                  <td
                                                    colSpan={7}
                                                    className="px-3 py-3 overflow-visible"
                                                  >
                                                    <div className="flex flex-col sm:flex-row sm:items-end gap-2 max-w-3xl">
                                                      <div className="flex-1 min-w-0 relative z-30">
                                                        <label className="block text-xs font-semibold text-sky-900 mb-1">
                                                          Recycled / By-product{" "}
                                                          <span className="text-red-500">
                                                            *
                                                          </span>
                                                        </label>
                                                        <Typeahead
                                                          id={`record-scrap-bp-full-${finishedGood.id}-${entry.id}`}
                                                          options={
                                                            byProductWasteOptions
                                                          }
                                                          labelKey={(o) =>
                                                            `${o.item_name || ""} (${o.sku || o.item_code || ""})`
                                                          }
                                                          placeholder={
                                                            byProductWasteOptions.length
                                                              ? "Search by-product from inventory…"
                                                              : "No by-product items found"
                                                          }
                                                          disabled={
                                                            !expectedSet
                                                          }
                                                          selected={
                                                            entry.wasteScrapByProductSelection ||
                                                            []
                                                          }
                                                          onChange={(sel) => {
                                                            handleOperatorEntryChange(
                                                              productionItem.id,
                                                              finishedGood.id,
                                                              entry.id,
                                                              "wasteScrapByProductSelection",
                                                              sel || [],
                                                            );
                                                          }}
                                                          clearButton
                                                          positionFixed
                                                          flip
                                                          className="w-full"
                                                          inputProps={{
                                                            id: `record-scrap-bp-full-input-${finishedGood.id}-${entry.id}`,
                                                            className:
                                                              "form-control h-10 text-sm border border-sky-400 rounded-md bg-white",
                                                          }}
                                                        />
                                                        <p className="text-[11px] text-sky-800/80 mt-1">
                                                          Required when waste
                                                          type is Recyclable.
                                                          {byProductWasteOptions.length
                                                            ? ` ${byProductWasteOptions.length} by-product option(s) available.`
                                                            : " Load products with item type By-Product if the list is empty."}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </td>
                                                </tr>
                                              )}
                                          </Fragment>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Yield summary band */}
                              {(() => {
                                const good = parseFloat(
                                  finishedGood.goodQuantity || 0,
                                );
                                const waste = parseFloat(
                                  finishedGood.wasteQuantity || 0,
                                );
                                const previousGood = parseFloat(
                                  finishedGood.previousGoodQuantity || 0,
                                );
                                const previousWaste = parseFloat(
                                  finishedGood.previousWasteQuantity || 0,
                                );
                                const expected = parseFloat(
                                  finishedGood.expectedQty || 0,
                                );
                                const totalOutput = good + waste;
                                const cumulativeOutput =
                                  previousGood + previousWaste + totalOutput;
                                const yieldPct =
                                  expected > 0
                                    ? (
                                        ((previousGood + good) / expected) *
                                        100
                                      ).toFixed(1)
                                    : null;
                                const yieldNum =
                                  yieldPct !== null ? parseFloat(yieldPct) : 0;
                                const barPct = Math.min(
                                  Math.max(yieldNum, 0),
                                  100,
                                );
                                return (
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-emerald-700" />
                                        <span className="text-sm font-semibold text-emerald-900">
                                          Yield Summary
                                        </span>
                                      </div>
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                                        {yieldPct === null
                                          ? "N/A"
                                          : `${yieldPct}%`}
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full bg-emerald-100 overflow-hidden mb-2">
                                      <div
                                        className="h-full rounded-full bg-emerald-500 transition-all"
                                        style={{ width: `${barPct}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-emerald-900/80 tabular-nums">
                                      Session: {totalOutput.toFixed(4)} ·
                                      Cumulative: {cumulativeOutput.toFixed(4)}{" "}
                                      / Expected {expected.toFixed(4)}
                                    </p>
                                    {expected > 0 &&
                                      cumulativeOutput < expected && (
                                        <div className="mt-3">
                                          <label className="block text-xs font-semibold text-red-600 mb-1">
                                            Shortfall Reason{" "}
                                            <span className="text-red-500">*</span>
                                          </label>
                                          <Input
                                            type="text"
                                            value={
                                              finishedGood.shortfallReason || ""
                                            }
                                            onChange={(e) =>
                                              handleFinishedGoodChange(
                                                productionItem.id,
                                                finishedGood.id,
                                                "shortfallReason",
                                                e.target.value,
                                              )
                                            }
                                            list={`shortfall-reason-suggestions-${productionItem.id}-${finishedGood.id}`}
                                            placeholder="Type reason (e.g. Engine failure)"
                                            className="w-full border border-red-300 rounded-md px-2 py-2 text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                                          />
                                          <datalist
                                            id={`shortfall-reason-suggestions-${productionItem.id}-${finishedGood.id}`}
                                          >
                                            {SHORTFALL_REASONS.map((reason) => (
                                              <option
                                                key={reason}
                                                value={reason}
                                              />
                                            ))}
                                          </datalist>
                                        </div>
                                      )}
                                  </div>
                                );
                              })()}

                              {/* Multiplier - Only show for process_costing */}
                              {activeBusiness?.costing_method ===
                                "process_costing" && (
                                <div
                                  className={`flex flex-col lg:col-span-3 ${
                                    Number(finishedGood.wasteQuantity || 0) > 0
                                      ? "lg:row-start-5"
                                      : "lg:row-start-4"
                                  } lg:col-start-1`}
                                >
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Multiplier{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <CreatableSelect
                                    isClearable
                                    isDisabled={!finishedGood.finishedGood}
                                    options={[
                                      ...allMultipliers.map((multiplier) => ({
                                        value: multiplier.id,
                                        label: `Name: ${multiplier.multiplier_type} | Value: ${multiplier.multiplier_value}`,
                                      })),
                                      {
                                        value: "__create__",
                                        label: "➕ Create New Multiplier",
                                        isCreateOption: true,
                                      },
                                    ]}
                                    formatOptionLabel={({ label, value }) => {
                                      if (value === "__create__") {
                                        return <span>{label}</span>;
                                      }
                                      return (
                                        <span className="font-bold">
                                          {label}
                                        </span>
                                      );
                                    }}
                                    value={
                                      finishedGood.multiplier
                                        ? {
                                            value: finishedGood.multiplier.id,
                                            label: `Name: ${finishedGood.multiplier.multiplier_type} | Value: ${finishedGood.multiplier.multiplier_value}`,
                                          }
                                        : null
                                    }
                                    onChange={(selected) => {
                                      if (!selected) {
                                        handleFinishedGoodMultiplierChange(
                                          productionItem.id,
                                          finishedGood.id,
                                          "",
                                        );
                                        return;
                                      }

                                      if (selected.value === "__create__") {
                                        // Handle create option - open modal
                                        handleCreateMultiplier(
                                          "",
                                          finishedGood,
                                          productionItem.id,
                                        );
                                        // Don't set the create option as the value - keep current selection or clear
                                        return;
                                      } else {
                                        handleFinishedGoodMultiplierChange(
                                          productionItem.id,
                                          finishedGood.id,
                                          selected.value,
                                        );
                                      }
                                    }}
                                    onCreateOption={(inputValue) => {
                                      handleCreateMultiplier(
                                        inputValue,
                                        finishedGood,
                                        productionItem.id,
                                      );
                                    }}
                                    placeholder={
                                      finishedGood.finishedGood
                                        ? "Select multiplier..."
                                        : "Select product first"
                                    }
                                    formatCreateLabel={(inputValue) =>
                                      `Create "${inputValue}"`
                                    }
                                    filterOption={(option, inputValue) => {
                                      // Always show the create option
                                      if (option.value === "__create__") {
                                        return true;
                                      }
                                      // Filter other options normally
                                      if (!inputValue) return true;
                                      return option.label
                                        .toLowerCase()
                                        .includes(inputValue.toLowerCase());
                                    }}
                                    styles={{
                                      control: (base, state) => ({
                                        ...base,
                                        border: state.isFocused
                                          ? "2px solid #10b981"
                                          : "2px solid #e5e7eb",
                                        borderRadius: "0.5rem",
                                        minHeight: "38px",
                                        fontSize: "0.875rem",
                                        boxShadow: state.isFocused
                                          ? "0 0 0 2px rgba(16, 185, 129, 0.2)"
                                          : "none",
                                        "&:hover": {
                                          border: state.isFocused
                                            ? "2px solid #10b981"
                                            : "2px solid #e5e7eb",
                                        },
                                      }),
                                      singleValue: (base) => ({
                                        ...base,
                                        fontWeight: "bold",
                                      }),
                                      menu: (base) => ({
                                        ...base,
                                        fontSize: "0.875rem",
                                      }),
                                      option: (base, state) => {
                                        const isCreateOption =
                                          state.data?.value === "__create__";
                                        return {
                                          ...base,
                                          backgroundColor: state.isSelected
                                            ? "#4267B2"
                                            : state.isFocused
                                              ? isCreateOption
                                                ? "#e0f2fe"
                                                : "#f0f9ff"
                                              : "white",
                                          color: state.isSelected
                                            ? "white"
                                            : isCreateOption
                                              ? "#4267B2"
                                              : "#1f2937",
                                          fontWeight: isCreateOption
                                            ? "600"
                                            : "normal",
                                          "&:active": {
                                            backgroundColor: "#4267B2",
                                            color: "white",
                                          },
                                        };
                                      },
                                    }}
                                    className="react-select-container"
                                    classNamePrefix="react-select"
                                  />
                                </div>
                              )}

                              {/* Delete Button */}
                              {productionItem.finishedGoods.length > 1 && (
                                <div className="flex items-center">
                                  <button
                                    onClick={() =>
                                      removeFinishedGood(
                                        productionItem.id,
                                        finishedGood.id,
                                      )
                                    }
                                    className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold flex items-center justify-center gap-2"
                                  >
                                    <Trash2 size={14} />
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-orange-200 shadow-sm">
                    {/* Ingredients Header */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b border-orange-200 rounded-t-lg">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
                          <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                            <Settings className="text-orange-600 w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-lg font-bold text-gray-900">
                              {costingType === "joint_shared"
                                ? "Raw Materials"
                                : "Ingredients"}{" "}
                              <span className="text-orange-600">
                                (Product Specific)
                              </span>
                            </h4>
                            <p className="text-sm text-gray-600">
                              Raw materials specific to this product
                            </p>
                          </div>
                        </div>
                        {/* {JSON.stringify(rawMaterialProducts)} */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <Badge className="bg-orange-100 text-orange-700">
                            {
                              productionItem.ingredients.filter((ing) =>
                                isIngredientType(ing.type || "raw_material"),
                              ).length
                            }{" "}
                            ingredient(s) (Total:{" "}
                            {productionItem.ingredients.length} item(s))
                          </Badge>
                          <button
                            onClick={() => addIngredient(productionItem.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold"
                          >
                            <Plus size={14} />
                            Add{" "}
                            {costingType === "joint_shared"
                              ? "Raw Material"
                              : "Ingredient"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Ingredients Content */}
                    <div className="overflow-visible">
                      {/* Ingredients Table - fixed layout to prevent column overlap */}
                      <div className="ingredients-table-wrapper overflow-x-auto overflow-y-visible">
                        <table className="min-w-full divide-y divide-gray-200 table-fixed">
                          <colgroup>
                            <col className="w-[55%] min-w-[300px]" />
                            <col className="w-[12%] min-w-[110px]" />
                            <col className="w-[12%] min-w-[120px]" />
                            <col className="w-[11%] min-w-[110px]" />
                            <col className="w-[10%] min-w-[90px]" />
                          </colgroup>
                          <thead className="bg-orange-50">
                            <tr>
                              <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                                Ingredients
                              </th>
                              <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                Expected Qty
                              </th>
                              <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                Actual Qty
                              </th>
                              <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                Balance Left
                              </th>
                              <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {productionItem.ingredients.filter((ing) =>
                              isIngredientType(ing.type || "raw_material"),
                            ).length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-4 py-8 text-center text-gray-500"
                                >
                                  <Settings className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                  <p>
                                    No ingredients added yet. Click &quot;Add{" "}
                                    {costingType === "joint_shared"
                                      ? "Raw Material"
                                      : "Ingredient"}
                                    &quot; to add ingredients.
                                  </p>
                                </td>
                              </tr>
                            ) : (
                              productionItem.ingredients
                                .filter((ing) =>
                                  isIngredientType(ing.type || "raw_material"),
                                )
                                .map((ingredient, ingIdx) => {
                                  const liveWipProduct =
                                    findWipProductMatch(ingredient);
                                  const isOutOfWipStock =
                                    ingredient.isOutOfWipStock === true ||
                                    !liveWipProduct ||
                                    getRmAvailableQty(liveWipProduct) <= 0;

                                  const totalFinishedGoodsQty =
                                    getTotalIngredientOutputQty(
                                      productionItem.finishedGoods,
                                    );

                                  const rawMaterialQty = parseFloat(
                                    ingredient.quantity || 0,
                                  );
                                  const qtyUsed = getIngredientExpectedQty(
                                    productionItem.finishedGoods,
                                    rawMaterialQty,
                                  );
                                  const actualQty = parseFloat(
                                    ingredient.actualQty || qtyUsed,
                                  );

                                  // Prefer live WIP qty over stale template snapshot
                                  const availableQty = liveWipProduct
                                    ? getRmAvailableQty(liveWipProduct)
                                    : parseFloat(ingredient.availableQty || 0);

                                  // Check if qty used exceeds available
                                  const isInsufficient =
                                    !isOutOfWipStock && actualQty > availableQty;
                                  const balanceLeft = Math.max(
                                    availableQty - actualQty,
                                    0,
                                  );

                                  return (
                                    <tr
                                      key={ingredient.id}
                                      className={
                                        isOutOfWipStock || isInsufficient
                                          ? "bg-red-50 hover:bg-red-100"
                                          : "bg-orange-50 hover:bg-orange-100"
                                      }
                                    >
                                      {/* Product Selection - relative + z-index so controls stay above adjacent columns */}
                                      <td className="px-2 py-2 align-top relative z-[2]">
                                        <div className="typeahead-dropup-wrapper relative">
                                          <Select
                                            id={`ingredient-product-${productionItem.id}-${ingredient.id}`}
                                            options={rawMaterialProducts.map(
                                              (product) => ({
                                                value: product,
                                                label: formatRmSelectLabel(product),
                                              }),
                                            )}
                                            placeholder="Select ingredient..."
                                            isClearable
                                            menuPlacement="top"
                                            value={
                                              ingredient.product
                                                ? {
                                                    value:
                                                      liveWipProduct ||
                                                      ingredient.product,
                                                    label: formatRmSelectLabel(
                                                      liveWipProduct ||
                                                        ingredient.product,
                                                    ),
                                                  }
                                                : null
                                            }
                                            onChange={(selected) => {
                                              handleIngredientChange(
                                                productionItem.id,
                                                ingredient.id,
                                                "product",
                                                selected
                                                  ? selected.value
                                                  : null,
                                              );
                                            }}
                                            styles={{
                                              control: (provided, state) => ({
                                                ...provided,
                                                minHeight: "38px",
                                                borderColor: state.isFocused
                                                  ? "#3b82f6"
                                                  : "#d1d5db",
                                                borderWidth: "1px",
                                                borderRadius: "0.5rem",
                                                boxShadow: state.isFocused
                                                  ? "0 0 0 3px rgb(59 130 246 / 0.1)"
                                                  : "none",
                                                fontSize: "14px",
                                                "&:hover": {
                                                  borderColor: state.isFocused
                                                    ? "#3b82f6"
                                                    : "#d1d5db",
                                                },
                                              }),
                                              menu: (provided) => ({
                                                ...provided,
                                                zIndex: 99999,
                                                marginBottom: "0.25rem",
                                              }),
                                              menuPortal: (provided) => ({
                                                ...provided,
                                                zIndex: 99999,
                                              }),
                                            }}
                                            menuPortalTarget={document.body}
                                          />
                                          {ingredient.product && (
                                            <p className="mt-1 text-xs text-gray-600">
                                              {isOutOfWipStock ? (
                                                <span className="text-red-700 font-semibold">
                                                  ⚠ Out of WIP Stock
                                                </span>
                                              ) : isInsufficient ? (
                                                <span className="text-red-700 font-semibold">
                                                  ⚠ Actual Qty (
                                                  {actualQty.toFixed(4)})
                                                  exceeds Available (
                                                  {availableQty.toFixed(4)})
                                                </span>
                                              ) : availableQty >= actualQty &&
                                                actualQty > 0 ? (
                                                <span className="text-green-700 font-semibold">
                                                  ✓ Available:{" "}
                                                  {availableQty.toFixed(4)} (Qty
                                                  Used: {actualQty.toFixed(4)})
                                                </span>
                                              ) : null}
                                            </p>
                                          )}
                                        </div>
                                      </td>

                                      {/* Expected Qty (calculated) */}
                                      <td className="px-2 py-2 text-center align-middle">
                                        <div className="flex flex-col items-center gap-1">
                                          <span
                                            className={`text-sm font-semibold ${
                                              isInsufficient
                                                ? "text-red-700"
                                                : availableQty >= actualQty &&
                                                    actualQty > 0
                                                  ? "text-green-700"
                                                  : "text-gray-700"
                                            }`}
                                          >
                                            {(() => {
                                              // Format with comma separators for integer part only
                                              const parts = qtyUsed
                                                .toFixed(4)
                                                .split(".");
                                              return `${formatNumber(parts[0])}.${
                                                parts[1]
                                              }`;
                                            })()}
                                          </span>
                                          {isInsufficient && (
                                            <span className="text-xs text-red-600 font-semibold">
                                              ⚠ Insufficient
                                            </span>
                                          )}
                                          {!isInsufficient &&
                                            availableQty >= actualQty &&
                                            actualQty > 0 && (
                                              <span className="text-xs text-green-600 font-semibold">
                                                ✓ Available
                                              </span>
                                            )}
                                        </div>
                                      </td>

                                      {/* Actual Qty (editable, defaults to expected qty) */}
                                      <td className="px-2 py-2 text-center">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={
                                            ingredient.actualQty !== undefined &&
                                            ingredient.actualQty !== null &&
                                            ingredient.actualQty !== ""
                                              ? formatNumberWithCommas(
                                                  String(ingredient.actualQty),
                                                )
                                              : formatNumberWithCommas(
                                                  qtyUsed.toFixed(4),
                                                )
                                          }
                                          onChange={(e) => {
                                            handleIngredientChange(
                                              productionItem.id,
                                              ingredient.id,
                                              "actualQty",
                                              sanitizeDecimalQtyInput(
                                                e.target.value,
                                              ),
                                            );
                                          }}
                                          placeholder="0.0000"
                                          disabled={isOutOfWipStock}
                                          autoFocus={
                                            ingIdx === 0 &&
                                            !parseFloat(ingredient.actualQty || 0)
                                          }
                                          className={`text-right text-sm w-full ${
                                            isOutOfWipStock
                                              ? "bg-red-100 border-red-300 cursor-not-allowed"
                                              : !parseFloat(ingredient.actualQty || 0)
                                                ? "border-red-400 bg-red-50 text-red-600 font-semibold"
                                                : ""
                                          }`}
                                        />
                                      </td>

                                      {/* Balance Left */}
                                      <td className="px-2 py-2 text-center align-middle">
                                        <span
                                          className={`text-sm font-semibold ${
                                            isInsufficient
                                              ? "text-red-700"
                                              : "text-green-700"
                                          }`}
                                        >
                                          {balanceLeft.toFixed(4)}
                                        </span>
                                      </td>

                                      {/* Action - relative z-index so Remove button stays clickable */}
                                      <td className="px-2 py-2 text-center relative z-[2]">
                                        <button
                                          onClick={() =>
                                            removeIngredient(
                                              productionItem.id,
                                              ingredient.id,
                                            )
                                          }
                                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-xs font-semibold flex items-center justify-center gap-1"
                                        >
                                          <Trash2 size={12} />
                                          Remove
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-4">
          <button
            onClick={addProductionItem}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
          >
            <Plus size={14} />
            Add Production Item
          </button>
        </div>
        {/* Sticky footer actions — same Cancel + handleSubmit wiring */}
        <div className="sticky bottom-0 z-30 -mx-2 mt-6 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-4 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
          <button
            onClick={() => navigate("/app/production/manufacturing")}
            className="flex items-center gap-2 px-5 py-2 border border-slate-300 bg-white text-slate-800 rounded-lg hover:bg-slate-50 transition-colors font-semibold text-sm"
          >
            <X size={16} />
            Cancel
          </button>
          {(() => {
            const hasOutOfStock = productionItems.some((item) =>
              item.ingredients?.some((ing) => {
                if (!isIngredientType(ing.type)) return false;
                if (!ing.product && !ing.rawMaterialSku && !ing.raw_material_sku)
                  return false;
                const live = findWipProductMatch(ing);
                return (
                  ing.isOutOfWipStock === true ||
                  !live ||
                  getRmAvailableQty(live) <= 0
                );
              }),
            );
            const missingTemplate =
              costingType === "joint_shared" && !selectedProductGroup;
            const isDisabled = loading || hasOutOfStock || missingTemplate;
            const buttonLabel = loading
              ? "Recording..."
              : missingTemplate
                ? "Select Expected Shared Costing Template"
                : hasOutOfStock
                  ? "Ingredients Unavailable"
                  : "Save production record";
            const buttonTitle = missingTemplate
              ? "Please select a shared costing template first"
              : hasOutOfStock
                ? "Some ingredients are out of WIP stock"
                : "";
            return (
              <button
                onClick={handleSubmit}
                disabled={isDisabled}
                title={buttonTitle}
                className="flex items-center gap-2 px-5 py-2 bg-[#4267B2] text-white rounded-lg hover:bg-[#365899] transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle size={18} />
                {buttonLabel}
              </button>
            );
          })()}
        </div>
      </div>

      {/* Custom Typeahead Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .rbt-input-main {
          width: 100%;
        }
        .rbt-input-main .form-control {
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          transition: all 0.2s;
        }
        .rbt-input-main .form-control:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .rbt-menu {
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          z-index: 9999 !important;
          position: absolute !important;
        }
        .rbt-menu.dropup,
        .rbt-input-main.dropup + .rbt-menu,
        .rbt-input-main.dropup ~ .rbt-menu {
          bottom: 100% !important;
          top: auto !important;
          margin-bottom: 0.25rem;
          margin-top: 0 !important;
        }
        .rbt-menu.dropup .dropdown-menu,
        .rbt-input-main.dropup + .rbt-menu .dropdown-menu {
          bottom: 0 !important;
          top: auto !important;
        }
        .rbt-menu .dropdown-menu {
          border: none;
          box-shadow: none;
          z-index: 9999 !important;
          position: absolute !important;
        }
        .rbt-input-main {
          position: relative;
        }
        /* Force dropup for all typeahead menus in ingredients section */
        table td .rbt-menu,
        .typeahead-dropup-wrapper .rbt-menu,
        .typeahead-dropup-wrapper ~ .rbt-menu,
        .typeahead-dropup-wrapper + .rbt-menu {
          bottom: 100% !important;
          top: auto !important;
          margin-bottom: 0.25rem !important;
          margin-top: 0 !important;
          transform: translateY(0) !important;
        }
        table td .rbt-menu .dropdown-menu,
        .typeahead-dropup-wrapper .rbt-menu .dropdown-menu {
          bottom: 0 !important;
          top: auto !important;
        }
        /* Override any default positioning */
        .rbt-input-main.dropup ~ .rbt-menu,
        .rbt-input-main.dropup + .rbt-menu {
          bottom: 100% !important;
          top: auto !important;
        }
        .rbt-menu .dropdown-item {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #f3f4f6;
        }
        .rbt-menu .dropdown-item:hover {
          background-color: #f0f9ff;
          color: #1e40af;
        }
        .rbt-menu .dropdown-item.active {
          background-color: #3b82f6;
          color: white;
        }
        /* Ingredients table - prevent column overlap and ensure proper stacking */
        .ingredients-table-wrapper {
          overflow-x: auto;
          overflow-y: visible;
        }
        .ingredients-table-wrapper table tbody tr td:first-child,
        .ingredients-table-wrapper table tbody tr td:last-child {
          position: relative;
          z-index: 2;
          background: inherit;
        }
        .ingredients-table-wrapper table tbody tr td:nth-child(2),
        .ingredients-table-wrapper table tbody tr td:nth-child(3),
        .ingredients-table-wrapper table tbody tr td:nth-child(4) {
          position: relative;
          z-index: 1;
        }
      `,
        }}
      />

      {/* Create Multiplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Create New Multiplier
                </h2>
                <button
                  onClick={handleCancelMultiplier}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveMultiplier();
                }}
                className="space-y-6"
              >
                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product *
                  </label>
                  <TypeaheadCustom
                    options={finishedGoodProducts || []}
                    placeholder="Search products by name or SKU..."
                    labelKey={(product) =>
                      `${product.item_name} (${product.item_code})`
                    }
                    onChange={(selectedItems) => {
                      const selectedProduct =
                        selectedItems.length > 0 ? selectedItems[0] : null;
                      setSelectedProduct(selectedProduct);
                      if (selectedProduct) {
                        handleMultiplierInputChange(
                          "product_id",
                          selectedProduct.item_code,
                        );
                        handleMultiplierInputChange(
                          "product_name",
                          selectedProduct.item_name,
                        );
                        handleMultiplierInputChange(
                          "sku",
                          selectedProduct.item_code,
                        );
                      } else {
                        handleMultiplierInputChange("product_id", "");
                        handleMultiplierInputChange("product_name", "");
                        handleMultiplierInputChange("sku", "");
                      }
                    }}
                    selected={selectedProduct ? [selectedProduct] : []}
                  />
                </div>

                {/* Multiplier Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 d-flex justify-between">
                      <span>Multiplier Size *</span>
                      <span>{}</span>
                    </label>
                    <input
                      type="text"
                      value={multiplierForm.multiplier_type}
                      onChange={(e) =>
                        handleMultiplierInputChange(
                          "multiplier_type",
                          e.target.value,
                        )
                      }
                      placeholder="Enter multiplier name e.g A1"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 d-flex justify-between align-items-center">
                      <span>Multiplier Value *</span>
                      <span className="text-xs">
                        {multiplierForm.multiplier_value
                          ? formatNumber(multiplierForm.multiplier_value)
                          : ""}
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={multiplierForm.multiplier_value}
                      onChange={(e) =>
                        handleMultiplierInputChange(
                          "multiplier_value",
                          e.target.value,
                        )
                      }
                      placeholder="Enter multiplier value"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={multiplierForm.status}
                    onChange={(e) =>
                      handleMultiplierInputChange("status", e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={handleCancelMultiplier}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !multiplierForm.multiplier_type.trim() ||
                      !multiplierForm.multiplier_value ||
                      !multiplierForm.product_id
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Create Multiplier
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
