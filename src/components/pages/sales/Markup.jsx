import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { FaInfoCircle } from "react-icons/fa";
import { Typeahead } from "react-bootstrap-typeahead";
import CreatableSelect from "react-select/creatable";
import {
  Ban,
  Check,
  Edit,
  Search,
  MoreVerticalIcon,
  Tag,
  DollarSign,
  Calculator,
  Plus,
  Eye,
  X,
  Package,
  Trash2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import CustomTable1 from "@/common/Custom/CustomTable1";
import { formatNumber, formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
  resolveDefaultBranchLocationId,
} from "@/utilities";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";

import { Badge } from "@/components/ui/badge";
import { EditItemDialog } from "../inventory/EditDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button as UIButton } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTemplateByProduct,
  computeSharedCostsGrandTotal,
  calculateSharedCostAmounts,
  computeSharedCostLineAmount,
  getTemplateByProductCreditAmount,
  resolveTemplateByProductHeaderUnitCost,
  sumSharedActualRawMaterialsTotal,
  getSharedCostExpectedTotal,
  getSharedCostActualTotal,
  getSharedCostRecipeQty,
  computeSharedCostScaleFromRawMaterials,
  normalizeSharedCostQtyUse,
  sumSharedActualRawMaterialsInputQty,
  getRmAvailableQty,
  resolveRawMaterialProductFromList,
} from "@/hooks/useTemplateByProduct";
import TemplateByProductSection from "./TemplateByProductSection";
import SharedCostingJournalPreview from "./SharedCostingJournalPreview";
import ProductionProductEntryHistory from "./ProductionProductEntryHistory";
import {
  buildJointSharedJournalPreview,
  mapJointSharedPreviewToLedgerPayload,
} from "./jointSharedJournalPreview";
import { isProductTaxable } from "@/utils/taxableStatus";

/** Same DR/CR display rules as `JournalEntryForm.jsx` (commas + decimal). */
function formatJournalStyleQtyInputDisplay(raw) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const stripped = parseNumberFromFormatted(String(raw).trim());
  if (stripped === "") return "";
  return formatNumberWithCommas(stripped);
}

/** Sanitize user typing for journal-style amount fields (debit/credit, rate/basis). */
function sanitizeJournalStyleAmountInput(value) {
  const withoutCommas = String(value ?? "").replace(/,/g, "");
  const sanitizedValue = filterJournalAmountInput(withoutCommas);
  const parts = sanitizedValue.split(".");
  const numericValue =
    parts.length > 2
      ? parts[0] + "." + parts.slice(1).join("")
      : sanitizedValue;
  return formatNumberWithCommas(numericValue);
}

function parseJournalStyleAmount(raw) {
  const parsed = parseNumberFromFormatted(String(raw ?? "").trim());
  if (parsed === "" || parsed == null) return 0;
  const n = parseFloat(parsed);
  return Number.isFinite(n) ? n : 0;
}

const journalAmountInputClassName = "w-full min-w-[5.5rem] text-right text-sm";

function buildSharedCostStubProduct(cost) {
  const name =
    cost?.rawMaterialName ||
    cost?.description ||
    cost?.product?.item_name ||
    cost?.product?.name ||
    "";
  const sku =
    cost?.rawMaterialSku ||
    cost?.product?.item_code ||
    cost?.product?.sku ||
    "";
  const id =
    cost?.rawMaterialId ||
    cost?.product?.product_id ||
    cost?.product?.id ||
    sku ||
    "";
  if (!name && !sku && !id) return null;
  return {
    id,
    product_id: id || sku,
    item_code: sku || id,
    sku: sku || id,
    item_name: name || sku || "Raw material",
    name: name || sku || "Raw material",
    unit_of_measure:
      cost?.product?.unit_of_measure || cost?.product?.uom || "units",
    balance: 0,
    qty: 0,
    quantity: 0,
    available_qty: 0,
    cost_price: cost?.unit_cost || cost?.rate || 0,
    unit_cost: cost?.unit_cost || cost?.rate || 0,
    item_type: "Raw Material",
  };
}

/** Match a shared-cost line to the latest WIP row (live balance). */
function resolveLiveWipProductForSharedCost(cost, rawMaterialProducts = []) {
  const { product, matchedInWip } = resolveRawMaterialProductFromList(
    {
      raw_material_sku: cost?.rawMaterialSku || cost?.product?.item_code || cost?.product?.sku,
      raw_material_id: cost?.rawMaterialId || cost?.product?.product_id || cost?.product?.id,
      raw_material_name: cost?.rawMaterialName || cost?.description,
      description: cost?.description,
    },
    rawMaterialProducts,
    null,
  );

  if (matchedInWip && product) {
    return { product, matchedInWip: true };
  }

  if (cost?.product && (cost.product.item_name || cost.product.name || cost.product.sku)) {
    // Prefer live WIP over a previously attached stub/snapshot
    if (matchedInWip && product) {
      return { product, matchedInWip: true };
    }
    const liveFromBase = resolveRawMaterialProductFromList(
      {
        raw_material_sku: cost.product.item_code || cost.product.sku,
        raw_material_id: cost.product.product_id || cost.product.id,
        raw_material_name: cost.product.item_name || cost.product.name,
        description: cost.product.item_name || cost.product.name,
      },
      rawMaterialProducts,
      null,
    );
    if (liveFromBase.matchedInWip && liveFromBase.product) {
      return liveFromBase;
    }
  }

  const stub = product || cost?.product || buildSharedCostStubProduct(cost);
  return { product: stub || null, matchedInWip: false };
}

function formatSharedCostQtyDisplay(value) {
  if (!Number.isFinite(value)) return "—";
  const parts = value.toFixed(4).split(".");
  return `${formatNumber(parts[0])}.${parts[1]}`;
}

const normProductKey = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const collectProductIdentityKeys = (product) => {
  if (!product) return [];
  return [
    product.id,
    product.product_id,
    product.item_code,
    product.itemCode,
    product.sku,
    product.SKU,
    product.productSku,
  ]
    .map(normProductKey)
    .filter(Boolean);
};

const productsShareIdentity = (a, b) => {
  if (!a || !b) return false;
  const keysA = collectProductIdentityKeys(a);
  const keysB = collectProductIdentityKeys(b);
  if (keysA.some((key) => keysB.includes(key))) return true;
  const nameA = normProductKey(a.item_name || a.name || a.productName);
  const nameB = normProductKey(b.item_name || b.name || b.productName);
  return Boolean(nameA && nameB && nameA === nameB);
};

const normalizeFinishedGoodProduct = (product) => {
  if (!product) return null;
  return {
    ...product,
    item_name: product.item_name || product.name || product.productName || "",
    name: product.name || product.item_name || product.productName || "",
    item_code:
      product.item_code ||
      product.itemCode ||
      product.sku ||
      product.SKU ||
      product.productSku ||
      "",
    sku:
      product.sku ||
      product.item_code ||
      product.itemCode ||
      product.productSku ||
      "",
  };
};

const findFinishedGoodInCatalog = (stored, catalog = []) => {
  if (!stored) return null;
  const match = catalog.find((product) =>
    productsShareIdentity(product, stored),
  );
  return normalizeFinishedGoodProduct(match || stored);
};

const resolveFinishedGoodFromFgRow = (fg, catalog = []) => {
  if (!fg) return null;
  const stored =
    fg.finishedGood ||
    fg.product ||
    (fg.sku ||
    fg.productSku ||
    fg.productId ||
    fg.product_id ||
    fg.productName ||
    fg.item_name
      ? {
          id: fg.productId || fg.product_id,
          product_id: fg.productId || fg.product_id,
          item_code: fg.sku || fg.productSku || fg.item_code,
          sku: fg.sku || fg.productSku || fg.item_code,
          item_name: fg.item_name || fg.productName || fg.name,
          unit_of_measure:
            fg.unitOfMeasure || fg.unit || fg.unit_of_measure || "",
          category: fg.category || "",
        }
      : null);
  return findFinishedGoodInCatalog(stored, catalog);
};

/** Merge joint/shared product-level ids onto FG rows saved from Record Production. */
const enrichFinishedGoodRowWithProductContext = (fg, item = {}) => {
  if (!fg || typeof fg !== "object") return fg;
  return {
    ...fg,
    productId:
      fg.productId ?? fg.product_id ?? item.productId ?? item.product_id,
    productSku: fg.productSku ?? fg.sku ?? item.productSku ?? item.product_sku,
    productName:
      fg.productName ?? fg.item_name ?? item.productName ?? item.product_name,
  };
};

const parseStoredWasteType = (fg) => {
  const raw =
    (typeof fg?.wasteType === "string"
      ? fg.wasteType
      : fg?.wasteType?.value || fg?.wasteType?.label) ??
    fg?.waste_type ??
    "";
  const t = String(raw).trim().toLowerCase();
  if (!t) return "";
  if (t === "abnorm" || t === "abnormal") return "abnormal";
  if (t === "recycled" || t === "recycle" || t === "recyclable") {
    return "recyclable";
  }
  if (t === "normal") return "normal";
  return "";
};

const normalizeFinishedGoodsList = (finishedGoods) => {
  if (!finishedGoods) return [];
  if (Array.isArray(finishedGoods)) return finishedGoods;
  if (typeof finishedGoods === "object") return [finishedGoods];
  return [];
};

/** Waste type exactly as saved on Record Production finished-good rows. */
const extractProductionWasteType = (fg, item = {}, parsedData = null) => {
  const fromFg = parseStoredWasteType(fg);
  if (fromFg) return fromFg;

  const productFgs = normalizeFinishedGoodsList(item?.finishedGoods);
  const fgId = fg?.id != null ? String(fg.id) : "";
  const fgSku =
    String(fg?.productSku || fg?.sku || "").trim() ||
    String(
      fg?.finishedGood?.item_code ||
        fg?.finishedGood?.sku ||
        fg?.finishedGood?.SKU ||
        "",
    ).trim();

  for (const productFg of productFgs) {
    const matchById =
      fgId && productFg?.id != null && String(productFg.id) === fgId;
    const productSku =
      String(productFg?.productSku || productFg?.sku || "").trim() ||
      String(
        productFg?.finishedGood?.item_code ||
          productFg?.finishedGood?.sku ||
          "",
      ).trim();
    const matchBySku =
      fgSku && productSku && fgSku.toLowerCase() === productSku.toLowerCase();
    if (!matchById && !matchBySku && productFgs.length > 1) continue;
    const fromProductFg = parseStoredWasteType(productFg);
    if (fromProductFg) return fromProductFg;
  }

  const wasteRow = (() => {
    const w = item?.waste;
    if (w == null) return null;
    if (Array.isArray(w)) return w.length > 0 ? w[0] : null;
    if (typeof w === "object") return w;
    return null;
  })();
  const fromItemWaste = parseStoredWasteType(wasteRow);
  if (fromItemWaste) return fromItemWaste;

  if (parsedData && typeof parsedData === "object") {
    const products = parsedData.products || parsedData.productionItems || [];
    for (const prod of products) {
      if (
        item?.productId &&
        prod?.productId &&
        String(prod.productId) !== String(item.productId)
      ) {
        continue;
      }
      if (
        item?.productSku &&
        prod?.productSku &&
        String(prod.productSku).trim().toLowerCase() !==
          String(item.productSku).trim().toLowerCase()
      ) {
        continue;
      }
      for (const prodFg of normalizeFinishedGoodsList(prod?.finishedGoods)) {
        const fromProdFg = parseStoredWasteType(prodFg);
        if (fromProdFg) return fromProdFg;
      }
    }
  }

  return "";
};

/** Resolve waste type when loading costing from Record Production payloads. */
const resolveCostingWasteTypeForLoad = (
  fg,
  { item, parsedData, wasteRowFromPayload } = {},
) => {
  const fromProduction = extractProductionWasteType(fg, item, parsedData);
  if (fromProduction) return fromProduction;
  if (wasteRowFromPayload) {
    const fromPayload = parseStoredWasteType(wasteRowFromPayload);
    if (fromPayload) return fromPayload;
  }
  return "";
};

const mergeProductionWasteFromManufacturingData = (
  productionItems,
  mfgData,
) => {
  if (!mfgData || !Array.isArray(productionItems)) return productionItems;
  const mfgProducts = mfgData.products || mfgData.productionItems || [];
  if (!mfgProducts.length) return productionItems;

  return productionItems.map((pi, idx) => {
    const mfgItem =
      mfgProducts.find(
        (p) =>
          (pi?.productId &&
            p?.productId &&
            String(p.productId) === String(pi.productId)) ||
          (pi?.productSku &&
            p?.productSku &&
            String(p.productSku).trim().toLowerCase() ===
              String(pi.productSku).trim().toLowerCase()),
      ) || mfgProducts[idx];
    if (!mfgItem) return pi;

    const mfgFgs = normalizeFinishedGoodsList(mfgItem.finishedGoods);
    if (!mfgFgs.length) return pi;

    return {
      ...pi,
      finishedGoods: (pi.finishedGoods || []).map((fg, fgIdx) => {
        const mfgFg =
          mfgFgs.find(
            (m) => fg?.id != null && String(m.id) === String(fg.id),
          ) ||
          mfgFgs[fgIdx] ||
          mfgFgs[0];
        const wasteType =
          extractProductionWasteType(mfgFg, mfgItem, mfgData) ||
          extractProductionWasteType(fg, pi, mfgData);
        return {
          ...fg,
          wasteType: wasteType || fg.wasteType || "",
          wasteReason: mfgFg?.wasteReason || fg.wasteReason || "",
          wasteQuantity:
            mfgFg?.wasteQuantity ?? mfgFg?.waste_quantity ?? fg.wasteQuantity,
          wasteScrapByProductSelection:
            Array.isArray(mfgFg?.wasteScrapByProductSelection) &&
            mfgFg.wasteScrapByProductSelection.length > 0
              ? mfgFg.wasteScrapByProductSelection
              : fg.wasteScrapByProductSelection,
        };
      }),
    };
  });
};

const getFinishedGoodTypeaheadSelected = (stored, catalog = []) => {
  const resolved = findFinishedGoodInCatalog(stored, catalog);
  return resolved ? [resolved] : [];
};

const isJointSharedCostingRecord = (record) =>
  record?.costing_type === "joint_shared" ||
  record?.type === "joint_shared" ||
  record?.costingType === "joint_shared";

const resolveMultiplierFromFgRow = (fg, multipliers = []) => {
  if (fg?.multiplier?.id || fg?.multiplier?.multiplier_value) {
    return fg.multiplier;
  }
  const multiplierId = fg?.multiplier_id ?? fg?.multiplierId;
  if (!multiplierId || !multipliers.length) return null;
  return multipliers.find((m) => String(m.id) === String(multiplierId)) || null;
};

const costingBatchKey = (row = {}) => {
  const batch = String(row.batch_no || row.batch_id || "").trim();
  const id = String(row.id || "").trim();
  if (batch) return batch;
  if (/^Batch-/i.test(id)) return id;
  return id;
};

/** One list row per batch on Costing & Pricing tab. */
const dedupeCostingRecords = (rows = []) => {
  const byBatchKey = new Map();
  for (const row of rows) {
    const key = costingBatchKey(row);
    if (!key) continue;
    const prev = byBatchKey.get(key);
    if (!prev) {
      byBatchKey.set(key, row);
      continue;
    }
    const rowTime = new Date(row.created_at || 0).getTime();
    const prevTime = new Date(prev.created_at || 0).getTime();
    if (rowTime > prevTime) {
      byBatchKey.set(key, row);
    }
  }
  return Array.from(byBatchKey.values()).sort(
    (a, b) =>
      new Date(b.created_at || 0).getTime() -
      new Date(a.created_at || 0).getTime(),
  );
};

export default function Markup() {
  const { activeBusiness = {}, user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const location = useLocation();
  const { recordId: costingRecordId } = useParams();
  const isCostingDetailPage = Boolean(costingRecordId);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("costing");
  const [editingPrices, setEditingPrices] = useState({});
  const [priceEditMode, setPriceEditMode] = useState({});
  const [markupItems, setMarkupItems] = useState([]);
  const [priceEditItems, setPriceEditItems] = useState([]);

  // Costing tab state
  const [productionRecords, setProductionRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [rejectConfirmRecord, setRejectConfirmRecord] = useState(null);
  const [rejectingRecord, setRejectingRecord] = useState(false);
  // HTML date input uses YYYY-MM-DD format
  const [productionDateInput, setProductionDateInput] = useState("2026-01-25");
  const [recordDetails, setRecordDetails] = useState(null);
  const [otherCostLines, setOtherCostLines] = useState([
    {
      id: Date.now(),
      description: "",
      account_code: "",
      descriptionCode: "",
      amount: 0,
      other_type: "rate",
      rate: 0,
      percentage_basis: "all_items", // Default to all items above
      type: "other", // Default to "other"
    },
    {
      id: Date.now() + 1,
      description: "",
      account_code: "",
      descriptionCode: "",
      amount: 0,
      other_type: "rate",
      rate: 0,
      percentage_basis: "all_items", // Default to all items above
      type: "other", // Default to "other"
    },
  ]);
  const [sharedCosts, setSharedCosts] = useState([]);
  const [sharedCostOutputPercentage, setSharedCostOutputPercentage] =
    useState(1);
  const [sharedCostQtyUse, setSharedCostQtyUse] = useState(1); // Qty use multiplier for shared costs
  const [sharedCostExpectedYieldPercent, setSharedCostExpectedYieldPercent] =
    useState(null);

  const usesSystemValuation = () =>
    activeBusiness?.default_valuation_source === "system_valuation";

  // default_cost: BOM/template rate, then product cost_price
  // system_valuation: WIP valuation (unit_cost from API), then product cost_price, then template
  const getSharedCostUnitCost = (templateRate, foundProduct) => {
    const rateNum = parseFloat(templateRate);
    const hasPositiveTemplateRate =
      templateRate != null &&
      templateRate !== "" &&
      !isNaN(rateNum) &&
      rateNum > 0;

    if (!usesSystemValuation()) {
      if (hasPositiveTemplateRate) return rateNum;
      const defaultPrice = parseFloat(foundProduct?.cost_price || 0);
      if (defaultPrice > 0) return defaultPrice;
      const wipUnit = parseFloat(foundProduct?.unit_cost || 0);
      if (wipUnit > 0) return wipUnit;
      return 0;
    }

    if (foundProduct) {
      const valuationUnit = parseFloat(foundProduct.unit_cost);
      const defaultPrice = parseFloat(foundProduct.cost_price || 0);
      if (Number.isFinite(valuationUnit) && valuationUnit > 0) {
        return valuationUnit;
      }
      if (defaultPrice > 0) return defaultPrice;
      if (hasPositiveTemplateRate) return rateNum;
    }

    return hasPositiveTemplateRate ? rateNum : 0;
  };

  const getMaterialTemplateRate = (ingredient) =>
    ingredient?.rate ??
    ingredient?.rate_amount ??
    ingredient?.template_rate ??
    null;

  const findRawMaterialProductForIngredient = (ingredient) => {
    if (!ingredient) return null;
    const matchKeys = [
      ingredient.rawMaterialSku,
      ingredient.rawMaterialId,
      ingredient.product?.sku,
      ingredient.product?.item_code,
      ingredient.product?.product_id,
      ingredient.product?.id,
    ]
      .filter((v) => v != null && String(v).trim() !== "")
      .map(String);

    if (rawMaterialProducts?.length && matchKeys.length) {
      const fromWip = rawMaterialProducts.find(
        (rm) =>
          matchKeys.some(
            (key) =>
              key === String(rm.sku) ||
              key === String(rm.item_code) ||
              key === String(rm.product_id) ||
              key === String(rm.id),
          ) ||
          (ingredient.rawMaterialName &&
            rm.item_name === ingredient.rawMaterialName) ||
          (ingredient.description && rm.item_name === ingredient.description),
      );
      if (fromWip) return fromWip;
    }

    return ingredient.product || null;
  };

  const resolveMaterialUnitCostFromValuation = (ingredient) => {
    const product = findRawMaterialProductForIngredient(ingredient);
    const templateRate = getMaterialTemplateRate(ingredient);
    const resolved = getSharedCostUnitCost(templateRate, product);
    if (resolved > 0) return resolved;

    // default_cost: keep a manually entered line rate when product has no default cost
    if (!usesSystemValuation()) {
      const savedRate = parseJournalStyleAmount(ingredient?.unit_cost);
      if (savedRate > 0) return savedRate;
    }

    return 0;
  };

  const [productGroups, setProductGroups] = useState([]);
  const [selectedProductGroup, setSelectedProductGroup] = useState(null);
  const [amountInputValues, setAmountInputValues] = useState({});
  const [expenseList, setExpenseList] = useState([]);
  const [productionDefaultAccounts, setProductionDefaultAccounts] =
    useState(null);
  const [scrapByProductOptions, setScrapByProductOptions] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [expandedProductionItem, setExpandedProductionItem] = useState(null);
  const [expandedFgSections, setExpandedFgSections] = useState({});

  const isFgSectionOpen = (section, productionItemId, fgId) =>
    expandedFgSections[`${section}:${productionItemId}:${fgId}`] !== false;

  const toggleFgSection = (section, productionItemId, fgId) => {
    const key = `${section}:${productionItemId}:${fgId}`;
    setExpandedFgSections((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  };
  const [finishedGoodProducts, setFinishedGoodProducts] = useState([]);
  const [rawMaterialProducts, setRawMaterialProducts] = useState([]);
  const [allMultipliers, setAllMultipliers] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [costingTemplates, setCostingTemplates] = useState([]);

  // By-Product modal state
  const [isByProductModalOpen, setIsByProductModalOpen] = useState(false);
  const [entryProductType, setEntryProductType] = useState("By-Product");
  const [byProductsList, setByProductsList] = useState([]);
  const [selectedByProduct, setSelectedByProduct] = useState(null);
  const [byProductForm, setByProductForm] = useState({
    quantity: "",
    cost_price: "",
    mark_up: "",
    markup_mode: "percentage",
    vat_rate: "7.5", // Default VAT rate
  });
  const [byProductSubmitting, setByProductSubmitting] = useState(false);
  const [productionEntryHistoryRefresh, setProductionEntryHistoryRefresh] =
    useState(0);
  const [productionAccounts, setProductionAccounts] = useState([]);
  const [productionAccountsLoading, setProductionAccountsLoading] =
    useState(false);
  const [selectedProductionAccount, setSelectedProductionAccount] =
    useState(null);
  const [productionAccountSearch, setProductionAccountSearch] = useState("");
  const [productionAccountOpen, setProductionAccountOpen] = useState(false);
  const [glJournalPreviewOpen, setGlJournalPreviewOpen] = useState(true);

  const resetEntryModalState = () => {
    setSelectedByProduct(null);
    setByProductForm({
      quantity: "",
      cost_price: "",
      mark_up: "",
      markup_mode: "percentage",
      vat_rate: "7.5",
    });
    setSelectedProductionAccount(null);
    setProductionAccountSearch("");
    setProductionAccountOpen(false);
    setGlJournalPreviewOpen(true);
  };
  // Base Value should be the Output Amount (TOTAL SHARED COSTS ÷ Output)
  const [multiplierBaseValue, setMultiplierBaseValue] = useState(0);
  // Target Value will be derived from TOTAL SHARED COSTS (sum of sharedCosts.amount)
  const [multiplierTargetValue, setMultiplierTargetValue] = useState(0);

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

  // Default the target branch to the business's default warehouse (fallback: first).
  const isDefaultBranchRow = (b) =>
    b?.is_default === 1 || b?.is_default === true || b?.is_default === "1";
  useEffect(() => {
    if (!branches.length) return;
    setTargetBranch((prev) => {
      if (prev && branches.some((b) => String(b.id) === String(prev))) {
        return prev;
      }
      const def = branches.find(isDefaultBranchRow);
      return def ? def.id : branches[0].id;
    });
  }, [branches]);

  useEffect(() => {
    if (!isByProductModalOpen || !activeBusiness?.id) {
      return;
    }
    setProductionAccountsLoading(true);
    _fetchApi(
      `/account/account-categories?facilityId=${activeBusiness.id}`,
      (resp) => {
        setProductionAccountsLoading(false);
        setProductionAccounts(Array.isArray(resp?.flat) ? resp.flat : []);
      },
      () => setProductionAccountsLoading(false),
    );
  }, [isByProductModalOpen, activeBusiness?.id]);

  useEffect(() => {
    if (
      !isByProductModalOpen ||
      entryProductType !== "By-Product" ||
      selectedProductionAccount ||
      !productionAccounts.length
    ) {
      return;
    }
    const wipCode = String(activeBusiness?.wip || "").trim();
    if (!wipCode) return;
    const wipAccount = productionAccounts.find(
      (acc) => String(acc.head || "").trim() === wipCode,
    );
    if (wipAccount) {
      setSelectedProductionAccount(wipAccount);
    }
  }, [
    isByProductModalOpen,
    entryProductType,
    productionAccounts,
    selectedProductionAccount,
    activeBusiness?.wip,
  ]);

  /** Required on Complete Batch when any material line is above 5% |actual−expected|/expected. */
  const [ingredientVarianceWrittenReason, setIngredientVarianceWrittenReason] =
    useState("");
  const ingredientVarianceReasonRef = useRef(null);

  const scrollToIngredientVarianceReason = useCallback(() => {
    ingredientVarianceReasonRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    const textarea = ingredientVarianceReasonRef.current?.querySelector(
      "textarea",
    );
    if (textarea && typeof textarea.focus === "function") {
      window.setTimeout(() => textarea.focus(), 300);
    }
  }, []);

  const templateByProduct = useTemplateByProduct({
    activeBusiness,
    rawMaterialProducts,
    fallbackByProductOptions: scrapByProductOptions,
  });

  useEffect(() => {
    const opts = templateByProduct.branchOptions;
    if (!opts?.length) return;
    setRecordDetails((prev) => {
      if (!prev || !prev.productionItems?.length) return prev;
      const first = opts[0];
      if (!first) return prev;
      let changed = false;
      const nextItems = prev.productionItems.map((item) => ({
        ...item,
        finishedGoods: item.finishedGoods.map((fg) => {
          if (!fg.finishedGood) return fg;
          const hasValidBranch =
            (fg.branchLocationId != null &&
              String(fg.branchLocationId) !== "" &&
              String(fg.branchLocationId) !== "0" &&
              opts.some((b) => String(b.id) === String(fg.branchLocationId))) ||
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
      if (!changed) return prev;
      return { ...prev, productionItems: nextItems };
    });
  }, [templateByProduct.branchOptions]);

  const isSelectedRecordJointShared =
    isJointSharedCostingRecord(selectedRecord);

  const showFinishedGoodMultiplierValue =
    isSelectedRecordJointShared ||
    activeBusiness?.costing_method === "job_product_costing";

  const showProcessCostingMultiplierSelect =
    activeBusiness?.costing_method === "process_costing" &&
    !isSelectedRecordJointShared;

  const templateHandlesByProduct = Boolean(
    isSelectedRecordJointShared && templateByProduct.selectedTemplateByProduct,
  );

  const templateByProductCreditAmount = useMemo(() => {
    if (!templateHandlesByProduct || !templateByProduct.selectedTemplateByProduct) {
      return 0;
    }
    const templateQty = Math.max(
      parseFloat(
        String(templateByProduct.templateByProductQty || "").replace(/,/g, ""),
      ) || 1,
      1,
    );
    return getTemplateByProductCreditAmount(
      templateByProduct.templateByProductItems,
      templateQty,
      templateByProduct.templateByProductUnitCost,
      templateByProduct.selectedTemplateByProduct,
    );
  }, [
    templateHandlesByProduct,
    templateByProduct.selectedTemplateByProduct,
    templateByProduct.templateByProductItems,
    templateByProduct.templateByProductQty,
    templateByProduct.templateByProductUnitCost,
  ]);

  const sharedCostTotals = useMemo(
    () =>
      computeSharedCostsGrandTotal(
        sharedCosts,
        sharedCostQtyUse,
        templateByProductCreditAmount,
        parseJournalStyleAmount,
        templateHandlesByProduct,
      ),
    [
      sharedCosts,
      sharedCostQtyUse,
      templateByProductCreditAmount,
      templateHandlesByProduct,
    ],
  );

  const sharedCostSummaryAmounts = useMemo(() => {
    const qtyUse = normalizeSharedCostQtyUse(sharedCostQtyUse);
    const grandTotal = sharedCostTotals.grandTotal;
    const byProductTotal = sharedCostTotals.templateByProductDeduction || 0;
    const subtotalBeforeByProduct = grandTotal + byProductTotal;
    const perRecipeUnitSubtotal = subtotalBeforeByProduct / qtyUse;
    const perRecipeUnitByProduct = byProductTotal / qtyUse;
    const totalSharedCostsPerUnit = grandTotal / qtyUse;
    const totalSharedCosts = totalSharedCostsPerUnit * qtyUse;
    return {
      perRecipeUnitSubtotal,
      perRecipeUnitByProduct,
      totalSharedCostsPerUnit,
      totalSharedCosts,
    };
  }, [sharedCostTotals, sharedCostQtyUse]);

  useEffect(() => {
    if (!isCostingDetailPage) {
      setIngredientVarianceWrittenReason("");
    }
  }, [isCostingDetailPage]);

  const { loadTemplateByProductOptions } = templateByProduct;

  useEffect(() => {
    if (isCostingDetailPage && isSelectedRecordJointShared) {
      loadTemplateByProductOptions();
    }
  }, [
    isCostingDetailPage,
    isSelectedRecordJointShared,
    loadTemplateByProductOptions,
  ]);

  useEffect(() => {
    if (!activeBusiness?.id || activeTab !== "costing") return;
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
  }, [activeBusiness?.id, activeTab]);

  /** By-product rows: same source as ProductList (`/api/products`, item_type === "By-Product") */
  useEffect(() => {
    if (!activeBusiness?.id || activeTab !== "costing") return;
    _fetchApi(
      `/api/products?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res?.success && Array.isArray(res.data)) {
          const rows = res.data
            .filter((p) => String(p.item_type || "").trim() === "By-Product")
            .map((p) => ({
              id: p.id,
              item_name: p.name || p.item_name,
              sku: p.sku || p.item_code,
              item_code: p.item_code || p.sku,
              inventory_account: p.inventory_account || "",
              item_type: p.item_type,
            }));
          setScrapByProductOptions(rows);
        }
      },
      (err) => {
        console.error("Error fetching by-product products:", err);
      },
    );
  }, [activeBusiness?.id, activeTab]);

  /** Same resolution order as complete-batch posting; for UI display of GL codes. */
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
        if (
          fieldName === "scrap_inventory_account" &&
          productionDefaultAccounts?.scrapInventoryAccount?.code != null &&
          String(
            productionDefaultAccounts.scrapInventoryAccount.code,
          ).trim() === code
        ) {
          description =
            productionDefaultAccounts.scrapInventoryAccount.description || null;
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
      if (
        fieldName === "scrap_inventory_account" &&
        productionDefaultAccounts?.scrapInventoryAccount?.code
      ) {
        const a = productionDefaultAccounts.scrapInventoryAccount;
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

  /** Seed Typeahead defaults per finished good when costing modal data & lookups load. */
  useEffect(() => {
    if (!isCostingDetailPage || !recordDetails?.productionItems?.length) return;

    setRecordDetails((prev) => {
      if (!prev?.productionItems?.length) return prev;
      let changed = false;
      const productionItems = prev.productionItems.map((pi) => ({
        ...pi,
        finishedGoods: (pi.finishedGoods || []).map((fg) => {
          const wt = String(fg.wasteType ?? fg.waste_type ?? "")
            .trim()
            .toLowerCase();
          const next = { ...fg };

          if (
            wt === "abnormal" &&
            !(next.wasteAbnormalLossExpenseSelection?.length > 0)
          ) {
            const { code: resolvedAbnormalCode } =
              getResolvedPostingAccountDisplay(
                "abnormal_loss_account",
                "Abnormal Loss",
              );
            if (resolvedAbnormalCode && expenseList?.length) {
              const m = expenseList.find(
                (e) =>
                  String(e.code || "").trim() ===
                  String(resolvedAbnormalCode).trim(),
              );
              if (m) {
                next.wasteAbnormalLossExpenseSelection = [m];
                changed = true;
              }
            }
          }
          if (
            wt === "recyclable" &&
            !(next.wasteScrapByProductSelection?.length > 0)
          ) {
            const { code: resolvedScrapCode } =
              getResolvedPostingAccountDisplay(
                "scrap_inventory_account",
                "Scrap Inventory",
              );
            if (resolvedScrapCode && scrapByProductOptions?.length) {
              const p = scrapByProductOptions.find(
                (x) =>
                  String(x.inventory_account || "").trim() ===
                  String(resolvedScrapCode).trim(),
              );
              if (p) {
                next.wasteScrapByProductSelection = [p];
                changed = true;
              }
            }
          }
          return next;
        }),
      }));
      return changed ? { ...prev, productionItems } : prev;
    });
  }, [
    isCostingDetailPage,
    selectedRecord?.id,
    productionDefaultAccounts?.abnormalLossAccount?.code,
    productionDefaultAccounts?.scrapInventoryAccount?.code,
    activeBusiness?.abnormal_loss_account,
    activeBusiness?.scrap_inventory_account,
    expenseList,
    scrapByProductOptions,
    recordDetails?.productionItems?.length,
    getResolvedPostingAccountDisplay,
  ]);

  // Calculate total multiplier from all finished goods across all products
  // Total Multiplier = Sum of (output units × Multiplier) for each finished good
  const computeTotalMultiplierFromItems = (productionItems) => {
    if (!productionItems?.length) return 0;

    return productionItems.reduce((sum, productionItem) => {
      const itemMultiplier = (productionItem.finishedGoods || []).reduce(
        (fgSum, finishedGood) => {
          const quantity = getFinishedGoodOutputUnits(finishedGood);
          let multiplierValue = 1.0;
          if (
            finishedGood.multiplierValue != null &&
            finishedGood.multiplierValue !== ""
          ) {
            const mv = parseFloat(finishedGood.multiplierValue);
            if (!isNaN(mv) && mv > 0) multiplierValue = mv;
          } else if (finishedGood.multiplier?.multiplier_value) {
            multiplierValue = parseFloat(
              finishedGood.multiplier.multiplier_value,
            );
          }
          return fgSum + quantity * multiplierValue;
        },
        0,
      );
      return sum + itemMultiplier;
    }, 0);
  };

  const calculateTotalMultiplier = () =>
    computeTotalMultiplierFromItems(recordDetails?.productionItems);

  const getSuggestedSharedCostOutput = () => {
    const totalMult = calculateTotalMultiplier();
    return totalMult > 0 ? parseFloat(totalMult.toFixed(4)) : null;
  };

  // Keep multiplierTargetValue in sync with TOTAL SHARED COSTS (incl. template by-product credit)
  useEffect(() => {
    if (!sharedCosts || sharedCosts.length === 0) {
      setMultiplierTargetValue(0);
      return;
    }
    setMultiplierTargetValue(
      parseFloat(sharedCostTotals.totalWithQtyUse.toFixed(2)),
    );
  }, [sharedCosts, sharedCostTotals.totalWithQtyUse]);

  // Keep multiplierBaseValue in sync: TOTAL SHARED COSTS PER UNIT ÷ Yield (%)
  useEffect(() => {
    const totalShared = parseFloat(multiplierTargetValue || 0);
    const qtyUse = parseFloat(sharedCostQtyUse || 1);
    const perUnit = qtyUse > 0 ? totalShared / qtyUse : 0;
    if (!perUnit) {
      setMultiplierBaseValue(0);
      return;
    }

    const outputQty =
      parseFloat(sharedCostOutputPercentage) ||
      computeTotalMultiplierFromItems(recordDetails?.productionItems) ||
      0;
    const rawMaterialQty = sumSharedActualRawMaterialsInputQty(sharedCosts, 1);

    if (!outputQty || !rawMaterialQty) {
      setMultiplierBaseValue(0);
      return;
    }

    const yieldPct = parseFloat(
      ((outputQty / rawMaterialQty) * 100).toFixed(4),
    );
    if (!yieldPct) {
      setMultiplierBaseValue(0);
      return;
    }

    setMultiplierBaseValue(perUnit / yieldPct);
  }, [
    sharedCosts,
    recordDetails?.productionItems,
    multiplierTargetValue,
    sharedCostQtyUse,
    sharedCostOutputPercentage,
  ]);

  // Output count should match Total Multiplier (Σ Good QTY × Multiplier / Value)
  const calculateScalingFactor = () => {
    const output = parseFloat(sharedCostOutputPercentage || 0);
    return Number.isFinite(output) ? output : 0;
  };

  // Keep Output in sync with Total Multiplier (not good qty alone)
  useEffect(() => {
    const isJoint =
      selectedRecord?.costing_type === "joint_shared" ||
      selectedRecord?.type === "joint_shared" ||
      selectedRecord?.costingType === "joint_shared";
    if (!isJoint || !recordDetails?.productionItems?.length) return;

    const totalMult = calculateTotalMultiplier();
    if (!totalMult || totalMult <= 0) return;

    setSharedCostOutputPercentage((prev) => {
      const prevVal = parseFloat(prev) || 0;
      if (Math.abs(prevVal - totalMult) < 0.0001) return prev;
      return parseFloat(totalMult.toFixed(4));
    });
  }, [
    recordDetails,
    selectedRecord?.costing_type,
    selectedRecord?.type,
    selectedRecord?.costingType,
    selectedRecord?.id,
  ]);

  useEffect(() => {
    const isJoint =
      selectedRecord?.costing_type === "joint_shared" ||
      selectedRecord?.type === "joint_shared" ||
      selectedRecord?.costingType === "joint_shared";
    if (!isJoint) return;

    const fromRawMaterials =
      computeSharedCostScaleFromRawMaterials(sharedCosts);
    if (fromRawMaterials != null && fromRawMaterials > 0) {
      setSharedCostQtyUse(fromRawMaterials);
      return;
    }

    // Wait until shared costs exist before deriving scale from output
    if (sharedCosts.length === 0) return;

    if (!recordDetails?.productionItems?.length) return;

    const outputUnits = parseFloat(sharedCostOutputPercentage || 1);
    if (!outputUnits || outputUnits <= 0) return;

    const totalMult = calculateTotalMultiplier();
    if (!totalMult || totalMult <= 0) {
      setSharedCostQtyUse(1);
      return;
    }
    setSharedCostQtyUse(parseFloat((totalMult / outputUnits).toFixed(4)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calculateTotalMultiplier only uses recordDetails (listed)
  }, [
    recordDetails,
    sharedCostOutputPercentage,
    sharedCosts,
    selectedRecord?.costing_type,
    selectedRecord?.type,
    selectedRecord?.costingType,
    selectedRecord?.id,
  ]);

  useEffect(() => {
    const isJoint =
      selectedRecord?.costing_type === "joint_shared" ||
      selectedRecord?.type === "joint_shared" ||
      selectedRecord?.costingType === "joint_shared";
    if (!isJoint || sharedCosts.length === 0) return;
    setSharedCosts((prev) =>
      calculateSharedCostAmounts(
        prev,
        sharedCostQtyUse,
        parseJournalStyleAmount,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedCostQtyUse]);

  const handleOpenDialog = (item) => {
    setSelectedItem(item);
    setIsDialogOpen(true);
  };

  const handleSaveChanges = (data) => {
    // Check if it's a markup update or a general item update
    if (data.mark_up !== undefined || data.markup_mode !== undefined) {
      // It's a markup update - use the new markup API
      const markupData = {
        sellingPrice:
          data.selling_price ||
          data.selling_price ||
          selectedItem?.selling_price,
        mark_up: data.mark_up || selectedItem?.mark_up,
        markup_mode: data.markup_mode || selectedItem?.markup_mode,
        id: data.id || selectedItem?.id,
        product_id: data.product_id || selectedItem?.product_id,
        expiry_date: data.expiry_date || selectedItem?.expiry_date,
        multiplier_id: data.multiplier_id || selectedItem?.multiplier_id,
        sku: data.sku || data.item_code || selectedItem?.sku,
        unit_of_measure: data.unit_of_measure || selectedItem?.unit_of_measure,
      };

      _postApi(
        "/inventory/markup-update",
        markupData,
        (response) => {
          if (response.success) {
            toast.success("Markup updated successfully");
            getMarkupData(); // Refresh the markup data
          } else {
            toast.error(response.message || "Failed to update markup");
          }
        },
        (err) => {
          toast.error("Error updating markup");
          console.error(err);
        },
      );
    } else {
      // It's a general item update - use the existing API
      _postApi(
        "/inventory/edit-item/update",
        data,
        (response) => {
          if (response.success) {
            toast.success("Item updated successfully");
          }
        },
        (err) => {
          toast.error("Error updating item");
          console.error(err);
        },
      );
    }
  };

  // Direct price editing functions
  const handlePriceEdit = (itemId) => {
    // Convert itemId to string for consistent comparison
    const itemIdStr = String(itemId);

    // Check if this item is already in edit mode
    const isCurrentlyEditing =
      priceEditMode[itemIdStr] === true || priceEditMode[itemId] === true;

    // If already editing, just return (user should use save/cancel)
    if (isCurrentlyEditing) {
      return;
    }

    // Check if any OTHER item is currently being edited
    const currentlyEditingItem = Object.keys(priceEditMode).find((id) => {
      const isEditing = priceEditMode[id] === true;
      const isDifferentItem = String(id) !== itemIdStr && id !== itemId;
      return isEditing && isDifferentItem;
    });

    // If another item is being edited, show a warning and return
    if (currentlyEditingItem) {
      toast.warning(
        "Please save or cancel the current edit before editing another item",
      );
      return;
    }

    // Get the item and set up edit mode
    const item = priceEditItems.find(
      (i) => String(i.id) === itemIdStr || i.id === itemId,
    );
    if (item) {
      const costPrice = item.valuation_cost || item.cost_price || 0;
      const currentSellingPrice =
        item.selling_price ||
        calculateSellingPrice(
          costPrice,
          item.mark_up,
          item.markup_mode,
          item.taxable,
          item.vat_rate,
        );

      // Enable edit mode for this item (use both string and original ID to ensure consistency)
      setPriceEditMode((prev) => ({
        ...prev,
        [itemId]: true,
        [itemIdStr]: true,
      }));

      // Set the initial editing price
      setEditingPrices((prev) => ({
        ...prev,
        [itemId]: {
          sellingPrice: currentSellingPrice,
        },
        [itemIdStr]: {
          sellingPrice: currentSellingPrice,
        },
      }));
    }
  };

  const handleFieldChange = useCallback((itemId, field, value) => {
    const itemIdStr = String(itemId);
    setEditingPrices((prev) => {
      const currentData = prev[itemId] || prev[itemIdStr] || {};
      return {
        ...prev,
        [itemId]: {
          ...currentData,
          [field]: value === "" ? "" : parseFloat(value) || 0,
        },
        [itemIdStr]: {
          ...currentData,
          [field]: value === "" ? "" : parseFloat(value) || 0,
        },
      };
    });
  }, []);
  // Fetch finished good products
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
          const normalized = (resp.results || []).map((item) => ({
            ...item,
            item_name: item.item_name || item.name,
            name: item.name || item.item_name,
            item_code: item.item_code || item.sku || item.itemCode,
            sku: item.sku || item.item_code || item.itemCode,
          }));
          setFinishedGoodProducts(normalized);
        } else {
          toast.error("Failed to load finished goods");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Error fetching finished goods");
      },
    );
  }, [activeBusiness?.id]);

  // Fetch products for quick inventory entry modal
  const fetchEntryProducts = useCallback(
    (productType = "By-Product") => {
      if (!activeBusiness?.id) return;

      if (productType === "Finished Good") {
        _postApi(
          `/inventory/product-list-1?query_type=select`,
          {
            facilityId: activeBusiness.id,
            type: "Finished Good",
          },
          (resp) => {
            if (resp.success) {
              const normalized = (resp.results || []).map((item) => ({
                ...item,
                item_name: item.item_name || item.name,
                item_code: item.item_code || item.sku,
                sku: item.sku || item.item_code,
              }));
              setByProductsList(normalized);
            } else {
              console.error("Failed to load finished goods");
            }
          },
          (err) => {
            console.error("Error fetching finished goods:", err);
          },
        );
        return;
      }

      _fetchApi(
        `/inventory/by-products?facilityId=${activeBusiness.id}`,
        (resp) => {
          if (resp.success) {
            setByProductsList(resp.results || []);
          } else {
            console.error("Failed to load by-products");
          }
        },
        (err) => {
          console.error("Error fetching by-products:", err);
        },
      );
    },
    [activeBusiness?.id],
  );

  const handleOpenProductEntryModal = useCallback(
    (productType) => {
      setEntryProductType(productType);
      fetchEntryProducts(productType);
      resetEntryModalState();
      setIsByProductModalOpen(true);
    },
    [fetchEntryProducts],
  );

  const shouldApplyVatOnMarkupPrice = (taxableStatus) =>
    isProductTaxable(taxableStatus) &&
    (activeBusiness?.vat_policy === "vat_inclusive" ||
      activeBusiness?.vat_policy === "all");

  const shouldShowVatInputForPolicy = () =>
    activeBusiness?.vat_policy === "vat_inclusive" ||
    activeBusiness?.vat_policy === "all";

  const calculateFinishedGoodSellingPrice = (costPerUnit, finishedGood) => {
    const baseCost = parseFloat(costPerUnit) || 0;
    const markupValue = parseFloat(finishedGood?.mark_up) || 0;
    const markupMode = finishedGood?.markup_mode || "percentage";
    const vatRate = parseFloat(finishedGood?.vat_rate) || 0;

    let sellingPrice = baseCost;
    if (markupMode === "percentage") {
      sellingPrice += (baseCost * markupValue) / 100;
    } else {
      sellingPrice += markupValue;
    }

    const vatEnabled = finishedGood?.apply_vat !== false;
    if (vatEnabled && shouldShowVatInputForPolicy() && vatRate > 0) {
      sellingPrice += sellingPrice * (vatRate / 100);
    }

    return parseFloat(sellingPrice.toFixed(2));
  };

  /** Scrap store line: unit cost + scrap-specific markup (% or fixed ₦), then VAT if enabled. */
  const calculateScrapSellingPriceForStore = (unitCost, scrapFgState) => {
    const baseCost = parseFloat(unitCost) || 0;
    const markupValue = parseFloat(scrapFgState?.wasteScrapMarkUp) || 0;
    const markupMode = scrapFgState?.wasteScrapMarkupMode || "percentage";
    const vatRate = parseFloat(scrapFgState?.wasteScrapVatRate) || 0;

    let sellingPrice = baseCost;
    if (markupMode === "percentage") {
      sellingPrice += (baseCost * markupValue) / 100;
    } else {
      sellingPrice += markupValue;
    }

    const vatEnabled = scrapFgState?.wasteScrapApplyVat !== false;
    if (vatEnabled && shouldShowVatInputForPolicy() && vatRate > 0) {
      sellingPrice += sellingPrice * (vatRate / 100);
    }

    return parseFloat(sellingPrice.toFixed(2));
  };

  // Handle By-Product form submission
  const handleByProductSubmit = async () => {
    const entryTypeLabel =
      entryProductType === "Finished Good" ? "finished good" : "by-product";

    if (!selectedByProduct) {
      toast.error(`Please select a ${entryTypeLabel}`);
      return;
    }

    if (!byProductForm.quantity || parseFloat(byProductForm.quantity) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    if (!targetBranch) {
      toast.error("Please select a warehouse");
      return;
    }

    if (!selectedProductionAccount?.head) {
      toast.error(
        entryProductType === "Finished Good"
          ? "Please select a Cost of Production account"
          : "Please select a credit account from chart of accounts",
      );
      return;
    }

    if (
      !byProductForm.cost_price ||
      parseFloat(byProductForm.cost_price) <= 0
    ) {
      toast.error("Please enter a valid cost price");
      return;
    }

    // Validate VAT rate when VAT should be applied for taxable items.
    if (shouldApplyVatOnMarkupPrice(selectedByProduct?.taxable)) {
      if (!byProductForm.vat_rate || parseFloat(byProductForm.vat_rate) <= 0) {
        toast.error("Please enter a valid VAT rate");
        return;
      }
    }

    setByProductSubmitting(true);

    const payload = {
      product_id: selectedByProduct.sku || selectedByProduct.item_code,
      facilityId: activeBusiness.id,
      quantity: parseFloat(byProductForm.quantity),
      cost_price: parseFloat(byProductForm.cost_price),
      mark_up: parseFloat(byProductForm.mark_up) || 0,
      markup_mode: byProductForm.markup_mode,
      taxable: selectedByProduct.taxable,
      vat_policy: activeBusiness.vat_policy,
      vat_rate: parseFloat(byProductForm.vat_rate) || 7.5,
      inserted_by: user?.username || user?.name || "System",
      branchId: targetBranch || 0,
      cost_of_production_account_code: selectedProductionAccount.head,
    };

    const entryEndpoint =
      entryProductType === "Finished Good"
        ? "/inventory/finished-good-entry"
        : "/inventory/by-product-entry";

    _postApi(
      entryEndpoint,
      payload,
      (resp) => {
        setByProductSubmitting(false);
        if (resp.success) {
          const ref =
            resp.data?.referenceNumber ||
            resp.data?.storeEntry?.reference_number ||
            "";
          const label =
            entryProductType === "Finished Good" ? "Finished good" : "By-product";
          toast.success(
            ref
              ? `${label} entry created successfully. Ref: ${ref}`
              : `${label} entry created successfully`,
          );
          setIsByProductModalOpen(false);
          resetEntryModalState();
          setProductionEntryHistoryRefresh((k) => k + 1);
          // Refresh data
          getMarkupData();
          getPriceEditData();
        } else {
          toast.error(
            resp.message || `Failed to create ${entryTypeLabel} entry`,
          );
        }
      },
      (err) => {
        setByProductSubmitting(false);
        console.error(`Error creating ${entryTypeLabel} entry:`, err);
        toast.error(err?.message || `Error creating ${entryTypeLabel} entry`);
      },
    );
  };

  // Calculate preview selling price for by-product
  const calculateByProductSellingPrice = () => {
    const costPrice = parseFloat(byProductForm.cost_price) || 0;
    const markup = parseFloat(byProductForm.mark_up) || 0;
    let sellingPrice = costPrice;

    if (byProductForm.markup_mode === "percentage") {
      sellingPrice = costPrice + (costPrice * markup) / 100;
    } else {
      sellingPrice = costPrice + markup;
    }

    // Add VAT for taxable items when business policy requires VAT on markup price.
    if (shouldApplyVatOnMarkupPrice(selectedByProduct?.taxable)) {
      const vatRate = parseFloat(byProductForm.vat_rate) || 0;
      if (vatRate > 0) {
        const vatAmount = sellingPrice * (vatRate / 100);
        sellingPrice = sellingPrice + vatAmount;
      }
    }

    return sellingPrice;
  };

  const calculateEntryGlAmount = () => {
    const qty = parseFloat(byProductForm.quantity) || 0;
    const unitCost = parseFloat(byProductForm.cost_price) || 0;
    if (qty <= 0 || unitCost <= 0) return 0;
    return Number((qty * unitCost).toFixed(2));
  };

  // Fetch data for markup management tab (items without markup)
  const getMarkupData = useCallback(() => {
    console.log("Fetching markup data...");
    _fetchApi(
      `/account/get-new-product/${activeBusiness.id}`,
      (data) => {
        console.log("Markup data received:", data);
        if (data && data.results) {
          setMarkupItems(data.results);
          console.log("Updated markupItems with", data.results.length, "items");
        } else {
          setMarkupItems([]);
          console.log("No markup data received from server");
        }
      },
      (err) => {
        console.error("Error fetching markup data:", err);
        toast.error("Error loading markup data");
        setMarkupItems([]);
      },
    );
  }, [activeBusiness.id]);

  // Fetch data for direct price editing tab (items ready for sales)
  const getPriceEditData = useCallback(() => {
    console.log("Fetching price edit data...");
    _fetchApi(
      `/account/get-ready-for-sales/${activeBusiness.id}`,
      (data) => {
        console.log("Price edit data received:", data);
        if (data && data.results) {
          setPriceEditItems(data.results);
          // Clear edit modes when data is refreshed
          setPriceEditMode({});
          setEditingPrices({});
          console.log(
            "Updated priceEditItems with",
            data.results.length,
            "items",
          );
        } else {
          setPriceEditItems([]);
          setPriceEditMode({});
          setEditingPrices({});
          console.log("No price edit data received from server");
        }
      },
      (err) => {
        console.error("Error fetching price edit data:", err);
        toast.error("Error loading price edit data");
        setPriceEditItems([]);
        setPriceEditMode({});
        setEditingPrices({});
      },
    );
  }, [activeBusiness.id]);

  // Fetch production records
  const getProductionRecords = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoadingRecords(true);
    _fetchApi(
      `/api/production/costing-records?facilityId=${activeBusiness.id}&page=1&limit=100`,
      (data) => {
        setLoadingRecords(false);
        console.log("Production records response:", data);
        if (data.success && data.data) {
          // API returns: { success: true, data: { productionRecords: [...], pagination: {...} } }
          let records = [];
          if (
            data.data.productionRecords &&
            Array.isArray(data.data.productionRecords)
          ) {
            records = data.data.productionRecords;
          } else if (Array.isArray(data.data)) {
            records = data.data;
          }
          // Filter to show only draft records
          const draftRecords = records.filter(
            (record) => record.status?.toLowerCase() === "draft",
          );
          setProductionRecords(dedupeCostingRecords(draftRecords));
        } else {
          setProductionRecords([]);
        }
      },
      (err) => {
        setLoadingRecords(false);
        console.error("Error fetching production records:", err);
        toast.error("Error loading production records");
        setProductionRecords([]);
      },
    );
  }, [activeBusiness?.id]);

  const openRejectCostingModal = useCallback((record) => {
    if (!record?.id) return;
    if (String(record.status || "").toLowerCase() === "completed") {
      toast.error("Completed batches cannot be rejected");
      return;
    }
    setRejectConfirmRecord(record);
  }, []);

  const confirmRejectCostingRecord = useCallback(() => {
    const record = rejectConfirmRecord;
    if (!activeBusiness?.id || !record?.id) return;

    setRejectingRecord(true);
    setLoadingRecords(true);
    _postApi(
      `/api/production/costing-records/${encodeURIComponent(record.id)}/reject`,
      { facilityId: activeBusiness.id },
      (resp) => {
        setRejectingRecord(false);
        setLoadingRecords(false);
        setRejectConfirmRecord(null);
        if (resp?.success) {
          toast.success(resp.message || "Batch rejected");
          setProductionRecords((prev) =>
            (prev || []).filter((r) => String(r.id) !== String(record.id)),
          );
          if (
            selectedRecord &&
            String(selectedRecord.id) === String(record.id)
          ) {
            setSelectedRecord(null);
            setRecordDetails(null);
          }
          getProductionRecords();
        } else {
          toast.error(resp?.message || "Failed to reject batch");
        }
      },
      (err) => {
        setRejectingRecord(false);
        setLoadingRecords(false);
        toast.error(err?.message || err?.error || "Failed to reject batch");
      },
    );
  }, [
    activeBusiness?.id,
    getProductionRecords,
    rejectConfirmRecord,
    selectedRecord,
  ]);

  // Fetch expense list for other costs
  const getExpenseList = useCallback(() => {
    if (!activeBusiness?.id) return;
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId: activeBusiness.id },
      (resp) => {
        if (resp.success) {
          // Show all accounts from the API response
          setExpenseList(
            (resp.results || []).map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
              account_type: item.account_type || "",
              show: item.show || "",
            })),
          );
        } else {
          toast.error("Failed to load expense list");
        }
      },
      (err) => {
        console.error("Error fetching expense list:", err);
        toast.error("Error fetching expense list");
      },
    );
  }, [activeBusiness?.id]);

  // Load costing templates and populate other costs
  const loadCostingTemplatesAndPopulateOtherCosts = useCallback(
    (productionItems) => {
      if (!activeBusiness?.id) return;

      _fetchApi(
        `/api/costing-templates?facilityId=${activeBusiness.id}`,
        (resp) => {
          console.log("Costing templates API response:", resp);
          // Handle response - it might be successful even if no templates exist
          if (resp) {
            const templates = resp.data || (resp.success ? [] : []);
            setCostingTemplates(templates);
            console.log(
              "Loaded costing templates:",
              templates.length,
              "templates",
            );

            if (
              resp.success === false &&
              resp.message &&
              resp.message.toLowerCase().includes("error")
            ) {
              // Only show error if it's an actual error, not just "no templates found"
              console.warn(
                "Costing templates API returned success=false with error message:",
                resp.message,
              );
            }

            // Get finished good product IDs from production items
            const finishedGoodProductIds = new Set();
            productionItems.forEach((item) => {
              item.finishedGoods?.forEach((fg) => {
                if (fg.finishedGood) {
                  const productId =
                    fg.finishedGood.id ||
                    fg.finishedGood.product_id ||
                    fg.finishedGood.item_code;
                  if (productId) {
                    finishedGoodProductIds.add(String(productId));
                  }
                }
              });
            });

            // Find "other" and "by_product_credit" type items from costing templates
            const otherCostItems = templates.filter(
              (template) =>
                (template.type === "other" ||
                  template.type === "by_product_credit") &&
                finishedGoodProductIds.has(
                  String(
                    template.finished_good_product_id || template.product_id,
                  ),
                ),
            );

            console.log(
              "Found otherCostItems:",
              otherCostItems.length,
              "for finishedGoodProductIds:",
              Array.from(finishedGoodProductIds),
            );

            // Add to other cost lines
            if (otherCostItems.length > 0) {
              // Calculate WIP cost directly from productionItems parameter
              const currentWipCost = productionItems.reduce(
                (sum, productionItem) => {
                  const itemCost =
                    productionItem.ingredients?.reduce((ingSum, ingredient) => {
                      const qty =
                        typeof ingredient.quantity === "string"
                          ? parseFloat(ingredient.quantity) || 0
                          : parseFloat(ingredient.quantity || 0);
                      const cost = parseFloat(
                        ingredient.unit_cost || ingredient.cost_price || 0,
                      );
                      return ingSum + qty * cost;
                    }, 0) || 0;
                  return sum + itemCost;
                },
                0,
              );

              const newOtherCostLines = otherCostItems
                .map((template) => {
                  const templateRate = parseFloat(template.rate || 0);
                  const templateQty = parseFloat(template.quantity || 0);
                  const otherType = template.other_type || "rate";
                  const percentageBasis =
                    template.percentage_basis || "all_items";

                  // Calculate amount based on type - always set amount
                  let calculatedAmount = 0;
                  if (otherType === "rate") {
                    calculatedAmount = templateRate;
                  } else if (otherType === "percentage") {
                    // Calculate percentage based on percentage_basis
                    if (percentageBasis === "raw_material") {
                      // Calculate percentage of current WIP cost
                      calculatedAmount = (currentWipCost * templateQty) / 100;
                    } else if (percentageBasis === "all_items") {
                      // For "all_items", we'll calculate it in calculateTotals
                      // For now, use raw material cost as initial value
                      calculatedAmount = (currentWipCost * templateQty) / 100;
                    }
                  }

                  return {
                    id: Date.now() + Math.random(),
                    description: template.description || "",
                    descriptionCode: template.description_code || "",
                    amount: calculatedAmount, // Always set amount, even if 0 initially
                    other_type: otherType,
                    rate: templateRate,
                    quantity: templateQty, // For percentage
                    percentage_basis: percentageBasis, // Store percentage basis
                    type: template.type || "other", // Track if it's "by_product_credit" or "other"
                    isFromTemplate: true,
                    templateId: template.id,
                  };
                })
                .filter(
                  (item) =>
                    item.amount > 0 || item.rate > 0 || item.quantity > 0,
                );

              // Add to existing other cost lines (keep at least 2 empty lines)
              setOtherCostLines((prev) => {
                const emptyLines = prev.filter(
                  (line) =>
                    !line.descriptionCode &&
                    !line.amount &&
                    !line.rate &&
                    !line.quantity,
                );
                return [...newOtherCostLines, ...emptyLines.slice(0, 2)];
              });
            }
          } else {
            // If resp.success is false, it might just mean no templates found
            console.warn("Costing templates API returned success=false:", resp);
            const templates = resp.data || [];
            setCostingTemplates(templates);
            // Don't show error toast - it's okay if there are no templates
            console.log(
              "No costing templates found or API returned false - this is okay, continuing without templates",
            );
          }
        },
        (err) => {
          console.error("API Error fetching costing templates:", err);
        },
      );
    },
    [activeBusiness?.id],
  );

  // Fetch data when component mounts
  useEffect(() => {
    getMarkupData();
    getPriceEditData();
    // Prefetch product options for manufacturing businesses
    if (activeBusiness?.business_type === "manufacturing") {
      fetchEntryProducts("By-Product");
    }
  }, [
    getMarkupData,
    getPriceEditData,
    activeBusiness?.business_type,
    fetchEntryProducts,
  ]);

  // Fetch raw material products (WIP items)
  const fetchRawMaterialProducts = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/inventory/wip?facilityId=${activeBusiness.id}`,
      (resp) => {
        console.log("WIP Inventory Data:", resp.data);
        if (resp.success) {
          setRawMaterialProducts(resp.data.wipItems || []);
        } else {
          toast.error("Failed to load WIP inventory data");
        }
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching WIP inventory data");
      },
    );
  }, [activeBusiness?.id]);

  // Fetch product groups (shared costing templates)
  const fetchProductGroups = useCallback(() => {
    if (!activeBusiness?.id) return;

    _fetchApi(
      `/inventory/product-groups?facilityId=${activeBusiness.id}`,
      (resp) => {
        console.log("Product groups API response:", resp);
        // Handle response - it might be successful even if no templates exist
        if (resp) {
          if (resp.success) {
            // Filter for shared costing templates
            const sharedTemplates = (resp.data || []).filter(
              (group) =>
                group.notes && group.notes.includes("Shared Costing Template"),
            );
            setProductGroups(sharedTemplates);
            console.log(
              "Loaded product groups (shared costing templates):",
              sharedTemplates.length,
              "templates",
            );
          } else {
            // If resp.success is false, it might just mean no templates found
            console.warn("Product groups API returned success=false:", resp);
            const sharedTemplates = (resp.data || []).filter(
              (group) =>
                group.notes && group.notes.includes("Shared Costing Template"),
            );
            setProductGroups(sharedTemplates);
            // Only show error if it's an actual error, not just "no templates found"
            if (resp.message && resp.message.toLowerCase().includes("error")) {
              console.warn(
                "Product groups API returned success=false with error message:",
                resp.message,
              );
              // Don't show toast - it's okay if there are no templates
            } else {
              console.log(
                "No product groups found or API returned false - this is okay, continuing without templates",
              );
            }
          }
        } else {
          // If resp is null/undefined, set empty array
          setProductGroups([]);
          console.log(
            "Product groups API returned null/undefined - this is okay, continuing without templates",
          );
        }
      },
      (err) => {
        console.error("API Error fetching product groups:", err);
        // Only show error toast for actual network/API errors, not for empty results
        // Silent failure is acceptable here since templates are optional
        setProductGroups([]);
      },
    );
  }, [activeBusiness?.id]);

  // Parse shared costs from product group notes
  const parseSharedCostsFromNotes = (notes) => {
    if (!notes) return [];

    let sharedCosts = [];
    let costingData = null;

    // Try to parse JSON first
    try {
      const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
      if (jsonMatch) {
        costingData = JSON.parse(jsonMatch[1]);
        if (costingData.sharedCosts) {
          sharedCosts = costingData.sharedCosts.map((item, index) => {
            const costItem = {
              id: Date.now() + index,
              type: item.type,
              description: item.description,
              quantity: item.quantity,
              expectedQuantity: item.quantity,
              actualQty:
                item.actual_qty ?? item.actualQty ?? item.actualQtyUsed ?? "",
              isActualQtyManuallySet: Boolean(
                item.isActualQtyManuallySet ?? item.is_actual_qty_manually_set,
              ),
              rate: item.rate,
              other_type: item.otherType || "rate",
              percentage_basis:
                item.percentageBasis === "raw_material"
                  ? "all_items"
                  : item.percentageBasis || "all_items",
              descriptionCode: item.descriptionCode,
              account_code: item.descriptionCode,
              account_head: item.accountHead,
              rawMaterialId: item.rawMaterialId,
              rawMaterialName: item.rawMaterialName,
              rawMaterialSku: item.rawMaterialSku,
              product: null,
            };

            // If it's a raw material, find and set the product
            if (costItem.type === "raw_material" && costItem.rawMaterialId) {
              const foundProduct = rawMaterialProducts.find(
                (rm) =>
                  String(rm.product_id) === String(costItem.rawMaterialId) ||
                  String(rm.item_code) === String(costItem.rawMaterialSku) ||
                  rm.item_name === costItem.rawMaterialName ||
                  rm.item_name === costItem.description,
              );
              if (foundProduct) {
                costItem.product = foundProduct;
                costItem.unit_cost =
                  foundProduct.unit_cost || foundProduct.cost_price || "";
              }
            }

            return costItem;
          });
        }
      }
    } catch (e) {
      console.warn(
        "Failed to parse JSON from notes, falling back to text parsing:",
        e,
      );
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
              other_type: inputTypeMatch ? inputTypeMatch[1] : "rate",
              percentage_basis:
                percentageBasisMatch &&
                percentageBasisMatch[1].trim() === "raw_material"
                  ? "all_items"
                  : percentageBasisMatch
                    ? percentageBasisMatch[1].trim()
                    : "all_items",
              descriptionCode: descriptionCodeMatch
                ? descriptionCodeMatch[1].trim()
                : null,
              account_code: descriptionCodeMatch
                ? descriptionCodeMatch[1].trim()
                : null,
              product: null,
            };

            // If it's a raw material, find and set the product
            if (costItem.type === "raw_material" && rawMaterialIdMatch) {
              const rawMaterialId = rawMaterialIdMatch[1].trim();
              const foundProduct = rawMaterialProducts.find(
                (rm) =>
                  String(rm.product_id) === String(rawMaterialId) ||
                  String(rm.item_code) ===
                    String(rawMaterialSkuMatch?.[1]?.trim()) ||
                  rm.item_name === rawMaterialNameMatch?.[1]?.trim() ||
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

    // Try to parse JSON first
    try {
      const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
      if (jsonMatch) {
        costingData = JSON.parse(jsonMatch[1]);
        if (costingData.products) {
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
    } catch (e) {
      console.warn(
        "Failed to parse JSON from notes, falling back to text parsing:",
        e,
      );
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
          // Keep currentProduct active
        } else if (
          inProducts &&
          line.match(/^\s+\d+\.\s*Type:/) &&
          currentProduct
        ) {
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

  // Handle product group selection
  const handleProductGroupChange = (groupId) => {
    const selectedGroup = productGroups.find((g) => g.id === parseInt(groupId));
    setSelectedProductGroup(selectedGroup);

    if (selectedGroup) {
      setSharedCostExpectedYieldPercent(
        parseTemplateExpectedYieldFromNotes(selectedGroup.notes),
      );

      const parsedProducts = parseProductsFromNotes(selectedGroup.notes);

      // Parse and set shared costs
      const parsedSharedCosts = parseSharedCostsFromNotes(selectedGroup.notes);
      setSharedCosts(
        calculateSharedCostAmounts(
          initializeSharedCostActualQty(parsedSharedCosts, sharedCostQtyUse),
          sharedCostQtyUse,
          parseJournalStyleAmount,
        ),
      );

      // Parse products and create production items
      if (parsedProducts.length > 0) {
        // Find products in finishedGoodProducts
        const newProductionItems = parsedProducts.map((product, index) => {
          const actualProduct = finishedGoodProducts.find(
            (p) => p.sku === product.sku || p.item_code === product.sku,
          );

          // Create ingredients from product specific items
          const ingredients = product.items
            .filter((item) => item.type === "raw_material")
            .map((item, itemIndex) => {
              const actualRawMaterial = rawMaterialProducts.find(
                (rm) =>
                  String(rm.product_id) === String(item.rawMaterialId) ||
                  String(rm.item_code) === String(item.rawMaterialSku) ||
                  rm.item_name === item.description,
              );

              const unitCostVal = getSharedCostUnitCost(
                item.rate ?? item.rate_amount,
                actualRawMaterial,
              );

              return {
                id: Date.now() + index * 1000 + itemIndex,
                type: "raw_material",
                product: actualRawMaterial || {
                  id: item.rawMaterialId || item.rawMaterialSku,
                  product_id: item.rawMaterialId || item.rawMaterialSku,
                  item_code: item.rawMaterialSku || item.rawMaterialId,
                  item_name: item.description,
                  unit_of_measure: "",
                  balance: 0,
                },
                quantity: String(item.quantity || "1"),
                unit_cost: unitCostVal,
                cost_price: unitCostVal,
                amount:
                  parseFloat(item.quantity || 0) * parseFloat(unitCostVal || 0),
              };
            });

          return {
            id: Date.now() + index,
            finishedGoods: [
              {
                id: Date.now() + index + 1000,
                finishedGood: actualProduct || null,
                quantity: "",
                quantity_formatted: "",
                goodQuantity: "",
                goodQuantity_formatted: "0.0000",
                wasteQuantity: "0.0000",
                wasteType: "",
                wasteReason: "",
                wasteAbnormalLossExpenseSelection: [],
                wasteScrapByProductSelection: [],
                wasteScrapSellingPrice: "",
                wasteScrapMarkupMode: "percentage",
                wasteScrapMarkUp: "",
                wasteScrapVatRate: "7.5",
                wasteScrapApplyVat: true,
                batchNo: getSelectedBatchNo(),
                warehouse: "",
                unitOfMeasure: actualProduct?.unit_of_measure || "",
                category: "",
                multiplier: null,
                multiplierValue: 1.0,
                expiry_date: "",
                mark_up: "",
                markup_mode: "percentage",
                vat_rate: "7.5",
                apply_vat: true,
              },
            ],
            ingredients: ingredients,
          };
        });

        // Update or create recordDetails
        if (recordDetails) {
          setRecordDetails({
            ...recordDetails,
            productionItems: newProductionItems,
          });
        } else {
          // Create initial recordDetails if it doesn't exist
          setRecordDetails({
            finishedGoods: [],
            rawMaterials: [],
            entries: [],
            productionItems: newProductionItems,
          });
        }

        // Auto-expand first production item
        if (newProductionItems.length > 0) {
          setExpandedProductionItem(newProductionItems[0].id);
        }
      }
    } else {
      setSharedCosts([]);
      setSharedCostOutputPercentage(1);
    }
  };

  // Fetch multipliers for a product
  const fetchProductsWithMultipliers = useCallback(
    (sku) => {
      if (!activeBusiness?.id) {
        console.log("No active business ID");
        return;
      }
      if (!sku) {
        console.log("No SKU provided");
        return;
      }

      console.log(
        "Fetching multipliers for SKU:",
        sku,
        "Facility:",
        activeBusiness.id,
      );

      _fetchApi(
        `/inventory/products-with-multipliers?facilityId=${activeBusiness.id}&sku=${sku}`,
        (resp) => {
          console.log("Multipliers API Response:", resp);
          if (resp.success) {
            console.log("Multipliers data:", resp.data);
            // Merge new multipliers with existing ones instead of replacing
            setAllMultipliers((prev) => {
              const newMultipliers = resp.data || [];
              const combined = [...prev];
              newMultipliers.forEach((multiplier) => {
                if (!combined.find((m) => m.id === multiplier.id)) {
                  combined.push(multiplier);
                }
              });
              return combined;
            });
          } else {
            console.error("Failed to load multipliers:", resp.message);
            toast.error("Failed to load products with multipliers");
          }
        },
        (err) => {
          console.error("API Error fetching multipliers:", err);
          toast.error("Error fetching products with multipliers");
        },
      );
    },
    [activeBusiness?.id],
  );

  // Add new production item
  const handleAddProductionItem = () => {
    if (!recordDetails) return;

    const newProductionItem = {
      id: Date.now(),
      finishedGoods: [
        {
          id: Date.now() + 1,
          finishedGood: null,
          quantity: "",
          quantity_formatted: "",
          goodQuantity: "",
          goodQuantity_formatted: "0.0000",
          wasteQuantity: "0.0000",
          wasteType: "",
          wasteReason: "",
          wasteAbnormalLossExpenseSelection: [],
          wasteScrapByProductSelection: [],
          wasteScrapSellingPrice: "",
          wasteScrapMarkupMode: "percentage",
          wasteScrapMarkUp: "",
          wasteScrapVatRate: "7.5",
          wasteScrapApplyVat: true,
          batchNo: "",
          warehouse: "",
          unitOfMeasure: "",
          category: "",
          expiry_date: "",
          mark_up: "",
          markup_mode: "percentage",
          vat_rate: "7.5",
          apply_vat: true,
        },
      ],
      ingredients: [],
    };

    setRecordDetails({
      ...recordDetails,
      productionItems: [...recordDetails.productionItems, newProductionItem],
    });

    // Auto-expand the new item
    setExpandedProductionItem(newProductionItem.id);
  };

  // Remove production item
  const handleRemoveProductionItem = (productionItemId) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.filter(
      (item) => item.id !== productionItemId,
    );

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });

    // If the removed item was expanded, clear the expanded state
    if (expandedProductionItem === productionItemId) {
      setExpandedProductionItem(null);
    }
  };

  const initializeSharedCostActualQty = (costs) =>
    (costs || []).map((cost) => {
      if ((cost.type || "raw_material") !== "raw_material") {
        return { ...cost, isActualQtyManuallySet: false };
      }
      const recipe = getSharedCostRecipeQty(cost);
      const existingActual =
        cost.actualQty != null && String(cost.actualQty).trim() !== ""
          ? String(cost.actualQty)
          : recipe > 0
            ? String(recipe.toFixed(4))
            : "";
      return {
        ...cost,
        expectedQuantity: cost.expectedQuantity ?? cost.quantity ?? recipe,
        quantity: cost.quantity ?? recipe,
        actualQty: existingActual,
        isActualQtyManuallySet: true,
      };
    });

  // Add shared cost line (for joint_shared costing type)
  const handleAddSharedCost = (costType = "raw_material") => {
    const newCost = {
      id: Date.now(),
      type: costType,
      product: null,
      description: "",
      descriptionCode: "",
      account_code: "",
      quantity: costType === "raw_material" ? "" : "",
      expectedQuantity: "",
      actualQty: "",
      isActualQtyManuallySet: false,
      unit_cost: "",
      rate: "",
      other_type: "rate",
      percentage_basis: "all_items",
      amount: 0,
    };
    setSharedCosts([...sharedCosts, newCost]);
  };

  // Remove shared cost line
  const handleRemoveSharedCost = (costId) => {
    setSharedCosts(sharedCosts.filter((cost) => cost.id !== costId));
  };

  // Update shared cost line
  const handleUpdateSharedCost = (costId, field, value) => {
    setSharedCosts((prevCosts) => {
      const updatedCosts = prevCosts.map((cost) => {
        if (cost.id === costId) {
          let processedValue = value;
          if (field === "unit_cost" || field === "rate") {
            processedValue = sanitizeJournalStyleAmountInput(value);
          }
          const updated = { ...cost, [field]: processedValue };
          // If product is selected, auto-fill unit_cost and description
          if (field === "product") {
            if (value) {
              const uc = getSharedCostUnitCost(cost.rate, value);
              updated.unit_cost =
                uc > 0 ? formatNumberWithCommas(String(uc)) : "";
              updated.description = value.item_name || value.name || "";
              updated.availableQty = getRmAvailableQty(value);
              updated.isOutOfWipStock = getRmAvailableQty(value) <= 0;
              updated.rawMaterialId = value.product_id || value.id || "";
              updated.rawMaterialSku = value.item_code || value.sku || "";
              updated.rawMaterialName = value.item_name || value.name || "";
            } else {
              // Clear fields when product is cleared
              updated.unit_cost = "";
              updated.description = "";
              updated.availableQty = 0;
              updated.isOutOfWipStock = true;
              updated.rawMaterialId = "";
              updated.rawMaterialSku = "";
              updated.rawMaterialName = "";
            }
          }
          // If account is selected, auto-fill descriptionCode and description
          if (field === "account") {
            if (value) {
              updated.descriptionCode = value.code || "";
              updated.description = value.name || "";
            } else {
              // Clear fields when account is cleared
              updated.descriptionCode = "";
              updated.description = "";
            }
          }
          if (field === "quantity") {
            updated.expectedQuantity = value;
            // Recipe qty is template reference only — do not overwrite actual qty.
          }
          if (field === "actualQty") {
            updated.isActualQtyManuallySet = true;
            const resolved = resolveLiveWipProductForSharedCost(
              updated,
              rawMaterialProducts,
            );
            const product =
              (resolved.matchedInWip ? resolved.product : null) ||
              updated.product ||
              cost.product;
            const availableQty = resolved.matchedInWip
              ? getRmAvailableQty(resolved.product)
              : 0;
            const entered = parseFloat(value) || 0;
            if (resolved.matchedInWip && entered > availableQty) {
              toast.error(
                `Actual qty cannot exceed available balance (${availableQty.toFixed(4)})`,
              );
              updated.actualQty = String(availableQty);
            } else if (!resolved.matchedInWip && product) {
              toast.error(
                "This raw material is not in WIP stock. Select a material with available qty.",
              );
              updated.actualQty = "0";
            } else if (entered < 0) {
              updated.actualQty = "0";
            } else {
              updated.actualQty = String(entered);
            }
          }
          return updated;
        }
        return cost;
      });

      return calculateSharedCostAmounts(
        updatedCosts,
        sharedCostQtyUse,
        parseJournalStyleAmount,
      );
    });
  };

  // Add finished good to a production item
  const handleAddFinishedGood = (productionItemId) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        return {
          ...item,
          finishedGoods: [
            ...item.finishedGoods,
            {
              id: Date.now(),
              finishedGood: null,
              quantity: "",
              quantity_formatted: "",
              goodQuantity: "",
              goodQuantity_formatted: "0.0000",
              wasteQuantity: "0.0000",
              wasteType: "",
              wasteReason: "",
              wasteAbnormalLossExpenseSelection: [],
              wasteScrapByProductSelection: [],
              wasteScrapSellingPrice: "",
              wasteScrapMarkupMode: "percentage",
              wasteScrapMarkUp: "",
              wasteScrapVatRate: "7.5",
              wasteScrapApplyVat: true,
              batchNo: getSelectedBatchNo(),
              warehouse: "",
              unitOfMeasure: "",
              category: "",
              multiplier: null,
              multiplierValue: 1.0,
              expiry_date: "",
              mark_up: "",
              markup_mode: "percentage",
              vat_rate: "7.5",
              apply_vat: true,
            },
          ],
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Remove finished good from a production item
  const handleRemoveFinishedGood = (productionItemId, finishedGoodId) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        const updatedFinishedGoods = item.finishedGoods.filter(
          (fg) => fg.id !== finishedGoodId,
        );
        // Ensure at least one finished good remains
        if (updatedFinishedGoods.length === 0) {
          toast.error("At least one finished good is required");
          return item;
        }
        return {
          ...item,
          finishedGoods: updatedFinishedGoods,
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Number formatting functions (same as JournalEntryForm)
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

  // Helper function to get numeric quantity value (handles both formatted and numeric)
  const getNumericQuantity = (quantity) => {
    if (!quantity || quantity === "") return 0;
    if (typeof quantity === "number") return quantity;
    const parsed = parseNumberFromFormatted(String(quantity));
    return parseFloat(parsed) || 0;
  };

  /**
   * Good output units used as the denominator for production cost per unit.
   * Normal waste is absorbed into good units — never divide by good + waste.
   * When explicit good qty is missing but total qty and normal waste are present,
   * derive good count as total − waste (productQty / quantity treated as total output).
   */
  const getCostingGoodQuantity = (fg) => {
    if (!fg) return 0;
    const wasteType = String(fg.wasteType ?? fg.waste_type ?? "normal")
      .trim()
      .toLowerCase();
    const wasteQty = getNumericQuantity(fg.wasteQuantity ?? 0);

    const hasExplicitGood =
      fg.goodQuantity !== undefined &&
      fg.goodQuantity !== null &&
      String(fg.goodQuantity).trim() !== "";

    if (hasExplicitGood) {
      return Math.max(0, getNumericQuantity(fg.goodQuantity));
    }

    const q = getNumericQuantity(fg.quantity);
    if ((wasteType === "normal" || wasteType === "") && wasteQty > 0) {
      return Math.max(0, q - wasteQty);
    }
    return Math.max(0, q);
  };

  /** Sum good qty across finished-good rows (excludes waste from normal-type denominator). */
  const getTotalGoodQuantityForItem = (productionItem) =>
    (productionItem?.finishedGoods || []).reduce((sum, fg) => {
      if (!fg?.finishedGood) return sum;
      return sum + getCostingGoodQuantity(fg);
    }, 0);

  /**
   * Output units for multiplier / rate scaling on one finished-good row.
   * Good qty + abnormal/recyclable waste when waste splits output; else good only.
   */
  const getFinishedGoodOutputUnits = (fg) => {
    if (!fg) return 0;
    const goodQty = getCostingGoodQuantity(fg);
    const wasteQty =
      parseFloat(
        String(fg.wasteQuantity ?? fg.waste_quantity ?? 0).replace(/,/g, ""),
      ) || 0;
    const wasteType = String(fg.wasteType ?? fg.waste_type ?? "normal")
      .trim()
      .toLowerCase();
    const splitsOutput =
      wasteQty > 0 &&
      (wasteType === "abnormal" ||
        wasteType === "abnorm" ||
        wasteType === "recyclable" ||
        wasteType === "recycled" ||
        wasteType === "recycle");
    if (splitsOutput) {
      return goodQty + wasteQty;
    }
    return goodQty;
  };

  // computeProductionCostPerUnit / computeProductionCostTotals — defined after
  // resolveMaterialActualQtyForBalance (uses Actual Qty from Cost Breakdown).

  const handleNumericInput = (value) => {
    // Allow numbers, dots, and commas
    return value.replace(/[^0-9.,]/g, "");
  };

  // Update finished good
  const handleUpdateFinishedGood = (
    productionItemId,
    finishedGoodId,
    field,
    value,
  ) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        const updatedFinishedGoods = item.finishedGoods.map((fg) => {
          if (fg.id === finishedGoodId) {
            const updated = {
              ...fg,
              [field]: value,
            };

            // Handle quantity formatting (similar to debit/credit in JournalEntryForm)
            if (field === "quantity" || field === "goodQuantity") {
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
              updated.quantity = numericValue; // Canonical quantity for calculations
              updated.quantity_formatted = formattedValue;
              updated.goodQuantity = numericValue;
              updated.goodQuantity_formatted = formattedValue;
            }

            if (field === "wasteQuantity") {
              const withoutCommas = String(value || "").replace(/,/g, "");
              const sanitizedValue = handleNumericInput(withoutCommas);
              const parts = sanitizedValue.split(".");
              const numericValue =
                parts.length > 2
                  ? parts[0] + "." + parts.slice(1).join("")
                  : sanitizedValue;
              updated.wasteQuantity = numericValue;
            }

            if (
              field === "wasteScrapSellingPrice" ||
              field === "wasteScrapVatRate" ||
              field === "wasteScrapMarkUp"
            ) {
              const withoutCommas = String(value || "").replace(/,/g, "");
              const sanitizedValue = handleNumericInput(withoutCommas);
              const parts = sanitizedValue.split(".");
              const numericValue =
                parts.length > 2
                  ? parts[0] + "." + parts.slice(1).join("")
                  : sanitizedValue;
              updated[field] = numericValue;
            }
            if (field === "wasteScrapApplyVat") {
              updated.wasteScrapApplyVat = Boolean(value);
            }
            if (field === "wasteScrapMarkupMode") {
              updated.wasteScrapMarkupMode = value;
            }

            if (field === "wasteType") {
              const v = String(value || "")
                .trim()
                .toLowerCase();
              if (v === "normal") {
                updated.wasteAbnormalLossExpenseSelection = [];
                updated.wasteScrapByProductSelection = [];
                updated.wasteScrapSellingPrice = "";
                updated.wasteScrapMarkupMode = "percentage";
                updated.wasteScrapMarkUp = "";
                updated.wasteScrapApplyVat = true;
                updated.wasteScrapVatRate = String(fg.vat_rate ?? "7.5");
              } else if (v === "abnormal") {
                updated.wasteScrapByProductSelection = [];
                updated.wasteScrapSellingPrice = "";
                updated.wasteScrapMarkupMode = "percentage";
                updated.wasteScrapMarkUp = "";
                if (fg.wasteAbnormalLossExpenseSelection?.length > 0) {
                  updated.wasteAbnormalLossExpenseSelection =
                    fg.wasteAbnormalLossExpenseSelection;
                } else {
                  const { code: resolvedAbnormalCode } =
                    getResolvedPostingAccountDisplay(
                      "abnormal_loss_account",
                      "Abnormal Loss",
                    );
                  if (resolvedAbnormalCode && expenseList?.length) {
                    const m = expenseList.find(
                      (e) =>
                        String(e.code || "").trim() ===
                        String(resolvedAbnormalCode).trim(),
                    );
                    updated.wasteAbnormalLossExpenseSelection = m ? [m] : [];
                  } else {
                    updated.wasteAbnormalLossExpenseSelection = [];
                  }
                }
              } else if (v === "recyclable") {
                updated.wasteAbnormalLossExpenseSelection = [];
                if (
                  updated.wasteScrapVatRate == null ||
                  updated.wasteScrapVatRate === ""
                ) {
                  updated.wasteScrapVatRate = String(fg.vat_rate ?? "7.5");
                }
                if (
                  (updated.wasteScrapMarkUp === "" ||
                    updated.wasteScrapMarkUp == null) &&
                  fg.mark_up !== "" &&
                  fg.mark_up != null
                ) {
                  updated.wasteScrapMarkUp = String(fg.mark_up);
                }
                if (fg.wasteScrapByProductSelection?.length > 0) {
                  updated.wasteScrapByProductSelection =
                    fg.wasteScrapByProductSelection;
                } else {
                  const { code: resolvedScrapCode } =
                    getResolvedPostingAccountDisplay(
                      "scrap_inventory_account",
                      "Scrap Inventory",
                    );
                  if (resolvedScrapCode && scrapByProductOptions?.length) {
                    const p = scrapByProductOptions.find(
                      (x) =>
                        String(x.inventory_account || "").trim() ===
                        String(resolvedScrapCode).trim(),
                    );
                    updated.wasteScrapByProductSelection = p ? [p] : [];
                  } else {
                    updated.wasteScrapByProductSelection = [];
                  }
                }
              }
            }

            // If product is selected, fetch multipliers
            if (field === "finishedGood" && value) {
              // Try multiple possible property names for product code/SKU
              const productCode =
                value.item_code ||
                value.itemCode ||
                value.sku ||
                value.SKU ||
                value.code ||
                value.product_code ||
                value.id;
              console.log(
                "handleUpdateFinishedGood - Product selected:",
                value,
                "Product Code:",
                productCode,
              );
              if (productCode) {
                // Use setTimeout to ensure state is updated first
                setTimeout(() => {
                  fetchProductsWithMultipliers(String(productCode));
                }, 100);
              } else {
                console.warn(
                  "No product code found in handleUpdateFinishedGood. Product object:",
                  value,
                );
              }
            }
            return updated;
          }
          return fg;
        });

        const fieldsAffectingIngredients = [
          "quantity",
          "goodQuantity",
          "wasteQuantity",
          "wasteType",
        ];
        const nextIngredients = fieldsAffectingIngredients.includes(field)
          ? syncIngredientsToOutputQty(item.ingredients, updatedFinishedGoods)
          : item.ingredients;

        return {
          ...item,
          finishedGoods: updatedFinishedGoods,
          ingredients: nextIngredients,
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });

    if (field === "wasteType") {
      const vt = String(value || "")
        .trim()
        .toLowerCase();
      if (vt === "recyclable") {
        const fid = finishedGoodId;
        setTimeout(() => {
          const byId = document.getElementById(`scrap-by-product-focus-${fid}`);
          if (byId && typeof byId.focus === "function") {
            byId.focus();
            return;
          }
          const wrap = document.getElementById(`post-scrap-bp-${fid}`);
          const inp = wrap?.querySelector?.(
            "input.rbt-input-main, input.rbt-input, input.form-control",
          );
          inp?.focus?.();
        }, 120);
      }
    }
  };

  const handleFinishedGoodBranchChange = (
    productionItemId,
    finishedGoodId,
    branchTableId,
  ) => {
    if (!recordDetails) return;
    const row = templateByProduct.branchOptions.find(
      (b) => String(b.id) === String(branchTableId),
    );
    const updatedProductionItems = recordDetails.productionItems.map((item) => {
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
    });
    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Handle multiplier change for finished good
  const handleFinishedGoodMultiplierChange = (
    productionItemId,
    finishedGoodId,
    multiplierId,
  ) => {
    if (!recordDetails) return;

    const selectedMultiplier = allMultipliers.find(
      (m) => String(m.id) === String(multiplierId),
    );

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        return {
          ...item,
          finishedGoods: item.finishedGoods.map((fg) => {
            if (fg.id === finishedGoodId) {
              return {
                ...fg,
                multiplier: selectedMultiplier || null,
                multiplierValue: selectedMultiplier?.multiplier_value || 1.0,
              };
            }
            return fg;
          }),
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Add ingredient to a production item
  const handleAddIngredient = (
    productionItemId,
    ingredientType = "raw_material",
  ) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        return {
          ...item,
          ingredients: [
            ...item.ingredients,
            {
              id: Date.now(),
              type: ingredientType,
              product: null,
              quantity: "",
              expectedQuantity: "",
              actualQuantity: "",
              unitOfMeasure: "",
              availableQty: 0,
              unit_cost: 0,
              cost_price: 0, // Keep for backward compatibility
              descriptionCode: "",
              description: "",
              account_head: "",
              other_type: ingredientType !== "raw_material" ? "rate" : "",
              rate: "",
              percentage_basis: "all_items",
              amount: 0,
            },
          ],
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Remove ingredient from a production item
  const handleRemoveIngredient = (productionItemId, ingredientId) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        const updatedIngredients = item.ingredients.filter(
          (ing) => ing.id !== ingredientId,
        );
        return {
          ...item,
          ingredients: updatedIngredients,
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Update ingredient
  const handleUpdateIngredient = (
    productionItemId,
    ingredientId,
    field,
    value,
  ) => {
    if (!recordDetails) return;

    const updatedProductionItems = recordDetails.productionItems.map((item) => {
      if (item.id === productionItemId) {
        const updatedIngredients = item.ingredients.map((ing) => {
          if (ing.id === ingredientId) {
            // Handle numeric fields
            let processedValue = value;
            if (field === "unit_cost" || field === "rate") {
              processedValue = sanitizeJournalStyleAmountInput(value);
            } else if (
              field === "quantity" ||
              field === "expectedQuantity" ||
              field === "actualQuantity"
            ) {
              processedValue =
                value === "" || value === null || value === undefined
                  ? ""
                  : value;
            }

            const updated = {
              ...ing,
              [field]: processedValue,
            };

            if (field === "actualQuantity") {
              updated.actualQty = processedValue;
              updated.actual_qty = processedValue;
              updated.isActualQtyManuallySet = true;
              const parsedActual = parseFloat(
                String(processedValue ?? "").replace(/,/g, ""),
              );
              updated.qtyUsed = Number.isFinite(parsedActual)
                ? parsedActual
                : "";
            }

            // If product is selected, update availableQty and unit_cost
            if (field === "product" && value) {
              updated.availableQty = parseFloat(value.balance || 0);
              const unitCost = getSharedCostUnitCost(
                getMaterialTemplateRate(ing),
                value,
              );
              updated.unit_cost =
                unitCost > 0 ? formatNumberWithCommas(String(unitCost)) : "";
              updated.cost_price = unitCost;
              updated.unitOfMeasure = value.unit_of_measure || "";
              updated.type =
                String(value.item_type || "").toLowerCase() === "semi finished"
                  ? "semi_finished"
                  : updated.type || "raw_material";
              // Set default quantity to 1 if empty, so cost shows immediately
              if (
                !updated.quantity ||
                updated.quantity === 0 ||
                updated.quantity === ""
              ) {
                updated.quantity = 1;
              }
            }
            return updated;
          }
          return ing;
        });

        // Recalculate amounts for all ingredients in this production item
        const parseIngActualQty = (ing) => {
          const manual =
            ing.actualQuantity ?? ing.actual_qty ?? ing.actualQty;
          const raw = ing.isActualQtyManuallySet
            ? (manual ?? "")
            : (manual ??
              ing.qtyUsed ??
              ing.qty_used ??
              manual);
          const parsed = parseFloat(String(raw ?? "").replace(/,/g, ""));
          if (Number.isFinite(parsed)) return parsed;
          if (ing.isActualQtyManuallySet) return 0;
          const expected = parseFloat(
            String(
              ing.expectedQuantity ?? ing.expected_qty ?? ing.expectedQty ?? "",
            ).replace(/,/g, ""),
          );
          if (Number.isFinite(expected)) return expected;
          return parseFloat(ing.quantity || 0) || 0;
        };

        const rawMaterialsTotal = updatedIngredients
          .filter((ing) => isMaterialType(getNormalizedIngredientType(ing)))
          .reduce(
            (sum, ing) =>
              sum +
              parseIngActualQty(ing) *
                (parseJournalStyleAmount(ing.unit_cost) ||
                  parseJournalStyleAmount(ing.cost_price)),
            0,
          );

        let runningTotal = rawMaterialsTotal;
        const ingredientsWithAmounts = updatedIngredients.map((ing) => {
          const ingType = getNormalizedIngredientType(ing);
          const inputType = ing.other_type || "rate";
          let amount = 0;

          if (isMaterialType(ingType)) {
            amount =
              parseIngActualQty(ing) *
              (parseJournalStyleAmount(ing.unit_cost) ||
                parseJournalStyleAmount(ing.cost_price));
          } else if (inputType === "rate") {
            amount = getOtherRateLineAmount(item, ing.rate);
          } else if (inputType === "percentage") {
            const pct = parseFloat(ing.quantity || 0);
            const basis = ing.percentage_basis || "all_items";
            if (basis === "raw_material") {
              amount = (pct / 100) * rawMaterialsTotal;
            } else if (basis === "all_items") {
              amount = (pct / 100) * runningTotal;
            }
          }

          const updatedIng = { ...ing, amount };

          // Update running total
          if (ingType === "by_product_credit") {
            runningTotal -= amount;
          } else if (!isMaterialType(ingType)) {
            runningTotal += amount;
          }

          return updatedIng;
        });

        return {
          ...item,
          ingredients: ingredientsWithAmounts,
        };
      }
      return item;
    });

    setRecordDetails({
      ...recordDetails,
      productionItems: updatedProductionItems,
    });
  };

  // Add other cost line
  const handleAddOtherCost = () => {
    setOtherCostLines([
      ...otherCostLines,
      {
        id: Date.now(),
        description: "",
        descriptionCode: "",
        amount: 0,
        other_type: "rate",
        rate: 0,
        percentage_basis: "all_items", // Default to all items above
        type: "other", // Default to "other"
      },
    ]);
  };

  // Remove other cost line
  const handleRemoveOtherCost = (id) => {
    if (otherCostLines.length <= 1) {
      toast.error("At least 2 cost items are required");
      return;
    }
    setOtherCostLines(otherCostLines.filter((line) => line.id !== id));
  };

  // Update other cost line
  const handleUpdateOtherCost = (id, field, value) => {
    setOtherCostLines((prevLines) => {
      return prevLines.map((line) => {
        if (line.id === id) {
          if (field === "descriptionCode") {
            // When Typeahead selects an expense (by code)
            // Only set descriptionCode, don't auto-fill description
            // Let user type description independently
            return {
              ...line,
              descriptionCode: value,
              // Only set description if it's currently empty
              description: line.description || "",
            };
          } else if (field === "description") {
            // When user types in description field manually
            return {
              ...line,
              description: value,
            };
          } else if (field === "amount") {
            // Remove commas and parse the value
            const numericValue =
              parseFloat(String(value).replace(/,/g, "")) || 0;
            return {
              ...line,
              [field]: numericValue,
            };
          } else if (field === "other_type") {
            // When other_type changes, recalculate amount if percentage
            const updated = {
              ...line,
              [field]: value,
              // Default percentage_basis to all_items when switching to percentage
              ...(value === "percentage" &&
              (!line.percentage_basis ||
                line.percentage_basis === "raw_material")
                ? { percentage_basis: "all_items" }
                : {}),
            };
            if (value === "percentage") {
              // Calculate percentage based on percentage_basis
              const totals = calculateTotals();
              const percentageBasis = line.percentage_basis || "all_items";
              const percentage = parseFloat(line.quantity || 0);

              if (percentageBasis === "raw_material") {
                const wipCost = totals.rawMaterialCost || 0;
                updated.amount = (wipCost * percentage) / 100;
              } else if (percentageBasis === "all_items") {
                // For "all_items", we'll recalculate in useEffect
                // For now, use raw material cost
                const wipCost = totals.rawMaterialCost || 0;
                updated.amount = (wipCost * percentage) / 100;
              }
            } else if (value === "rate") {
              // Use rate directly
              updated.amount = parseFloat(line.rate || 0);
            }
            return updated;
          } else if (field === "percentage_basis") {
            // When percentage_basis changes, recalculate amount if percentage type
            const updated = {
              ...line,
              [field]: value,
            };
            if (line.other_type === "percentage" && line.quantity) {
              const totals = calculateTotals();
              const percentage = parseFloat(line.quantity || 0);

              if (value === "raw_material") {
                const wipCost = totals.rawMaterialCost || 0;
                updated.amount = (wipCost * percentage) / 100;
              } else if (value === "all_items") {
                // For "all_items", we'll recalculate in useEffect
                // For now, use raw material cost
                const wipCost = totals.rawMaterialCost || 0;
                updated.amount = (wipCost * percentage) / 100;
              }
            }
            return updated;
          } else if (field === "quantity" && line.other_type === "percentage") {
            // When quantity changes for percentage type, recalculate amount based on percentage_basis
            const totals = calculateTotals();
            const percentageBasis = line.percentage_basis || "all_items";
            const percentage = parseFloat(value || 0);
            let amount = 0;

            if (percentageBasis === "raw_material") {
              const wipCost = totals.rawMaterialCost || 0;
              amount = (wipCost * percentage) / 100;
            } else if (percentageBasis === "all_items") {
              // For "all_items", we'll recalculate in useEffect
              // For now, use raw material cost
              const wipCost = totals.rawMaterialCost || 0;
              amount = (wipCost * percentage) / 100;
            }

            return {
              ...line,
              quantity: value,
              amount: amount,
            };
          } else if (
            field === "rate" &&
            (!line.other_type || line.other_type === "rate")
          ) {
            // When rate changes for rate type (or default), update amount
            return {
              ...line,
              rate: value,
              amount: parseFloat(value || 0),
              other_type: line.other_type || "rate",
            };
          }
          return {
            ...line,
            [field]: value,
          };
        }
        return line;
      });
    });
  };

  // Calculate totals
  const calculateTotals = () => {
    // Calculate raw material cost from production items' ingredients
    const rawMaterialCost =
      recordDetails?.productionItems?.reduce((sum, productionItem) => {
        const itemCost =
          productionItem.ingredients?.reduce((ingSum, ingredient) => {
            // Handle both string and number quantities
            const qty =
              typeof ingredient.quantity === "string"
                ? parseFloat(ingredient.quantity) || 0
                : parseFloat(ingredient.quantity || 0);
            const cost = parseFloat(
              ingredient.unit_cost || ingredient.cost_price || 0,
            );
            const lineTotal = qty * cost;
            return ingSum + lineTotal;
          }, 0) || 0;
        return sum + itemCost;
      }, 0) || 0;

    // Calculate other costs - handle percentage types with percentage_basis
    // For "all_items" basis, we need to calculate iteratively
    // For "by_product_credit" type, subtract from total instead of adding
    let runningTotal = rawMaterialCost;
    const totalOtherCosts = otherCostLines?.reduce((sum, line) => {
      const isByProductCredit = line.type === "by_product_credit";
      let amount = 0;

      if (line.other_type === "percentage" && line.quantity) {
        const percentage = parseFloat(line.quantity || 0);
        const percentageBasis = line.percentage_basis || "all_items";

        if (percentageBasis === "raw_material") {
          // Calculate percentage of raw material cost only
          amount = (rawMaterialCost * percentage) / 100;
        } else if (percentageBasis === "all_items") {
          // Calculate percentage of all items above (raw material + previous other costs)
          amount = (runningTotal * percentage) / 100;
        }

        // Update running total for next "all_items" calculation
        // For by_product_credit, subtract from running total; otherwise add
        if (isByProductCredit) {
          runningTotal -= amount;
          return sum - amount; // Subtract from total
        } else {
          runningTotal += amount;
          return sum + amount; // Add to total
        }
      }

      const lineAmount = line.amount || 0;
      // Update running total for rate types too
      if (isByProductCredit) {
        runningTotal -= lineAmount;
        return sum - lineAmount; // Subtract from total
      } else {
        runningTotal += lineAmount;
        return sum + lineAmount; // Add to total
      }
    }, 0);

    const totalProductionCost = rawMaterialCost + totalOtherCosts;

    // Calculate finished goods quantity from production items (with multiplier)
    const finishedGoodsQty =
      recordDetails?.productionItems?.reduce((sum, productionItem) => {
        const itemQty =
          productionItem.finishedGoods?.reduce((fgSum, finishedGood) => {
            const quantity = getCostingGoodQuantity(finishedGood);
            // Prioritize multiplier object's value over multiplierValue field
            let multiplierValue = 1.0;
            if (finishedGood.multiplier?.multiplier_value) {
              multiplierValue = parseFloat(
                finishedGood.multiplier.multiplier_value,
              );
            } else if (
              finishedGood.multiplierValue &&
              parseFloat(finishedGood.multiplierValue) !== 1.0
            ) {
              multiplierValue = parseFloat(finishedGood.multiplierValue);
            }
            // Quantity * multiplier value gives the effective quantity
            return fgSum + quantity * multiplierValue;
          }, 0) || 0;
        return sum + itemQty;
      }, 0) || 0;

    const costPerUnit =
      finishedGoodsQty > 0 ? totalProductionCost / finishedGoodsQty : 0;

    return {
      rawMaterialCost,
      totalOtherCosts,
      totalProductionCost,
      costPerUnit,
      finishedGoodsQty,
    };
  };

  // Save other costs, generate journal entries
  // eslint-disable-next-line no-unused-vars
  const handleSaveOverhead = async () => {
    if (!selectedRecord || !activeBusiness?.id) {
      toast.error("Please select a production record");
      return;
    }

    // Get WIP account from business settings
    const wipAccount = activeBusiness.wip || "";

    if (!wipAccount) {
      toast.error("WIP account not configured");
      return;
    }

    // Validate all other cost lines
    // Description is not required, but Account Head and Amount are required
    // If Account Head is selected, Amount must be provided, and vice versa

    // Recalculate amounts for percentage types before validation
    const totals = calculateTotals();
    const wipCost = totals.rawMaterialCost || 0;

    for (const line of otherCostLines) {
      const hasAccountHead = line.descriptionCode || line.account_code || "";

      // Check if there's a value based on type - be more lenient
      let hasValue = false;

      if (line.other_type === "percentage") {
        // For percentage type, check if percentage (quantity) is provided
        // Handle both number and string types
        let quantityValue = 0;
        if (typeof line.quantity === "number") {
          quantityValue = line.quantity;
        } else if (line.quantity) {
          const quantityStr = String(line.quantity).replace(/,/g, "").trim();
          quantityValue = quantityStr ? parseFloat(quantityStr) : 0;
        }
        hasValue = quantityValue > 0 && !isNaN(quantityValue);
      } else {
        // For rate type (or default), check if rate or amount is provided
        // Try multiple ways to get the value - handle formatted numbers
        let rateValue = 0;
        let amountValue = 0;

        // Handle rate - can be number or string
        if (typeof line.rate === "number") {
          rateValue = line.rate;
        } else if (line.rate) {
          const rateStr = String(line.rate).replace(/,/g, "").trim();
          rateValue = rateStr ? parseFloat(rateStr) : 0;
        }

        // Handle amount - can be number or string
        if (typeof line.amount === "number") {
          amountValue = line.amount;
        } else if (line.amount) {
          const amountStr = String(line.amount).replace(/,/g, "").trim();
          amountValue = amountStr ? parseFloat(amountStr) : 0;
        }

        // Check if either rate or amount has a valid positive value
        hasValue =
          (rateValue > 0 && !isNaN(rateValue)) ||
          (amountValue > 0 && !isNaN(amountValue));
      }

      // Skip validation for completely empty lines (no account head and no value)
      if (!hasAccountHead && !hasValue) {
        continue;
      }

      // If Account Head is provided, a value (rate/percentage/amount) must be provided
      if (hasAccountHead && !hasValue) {
        if (line.other_type === "percentage") {
          toast.error(
            "Please enter a percentage for the selected account head",
          );
        } else {
          toast.error(
            "Please enter a rate or amount for the selected account head",
          );
        }
        return;
      }

      // If a value is provided, Account Head must be provided
      if (hasValue && !hasAccountHead) {
        toast.error("Please select an account head for the entered value");
        return;
      }
    }

    const journalEntries = [];

    // Get production date from selected record, fallback to current date
    const productionDate = moment(
      productionDateInput,
      "YYYY-MM-DD",
      true,
    ).format("YYYY-MM-DD");

    // Process other cost lines - only process lines that have both Account Head and Amount
    otherCostLines.forEach((line) => {
      // Use descriptionCode if available (from Typeahead), otherwise use description as account code
      const expenseAccountCode =
        line.descriptionCode || line.account_code || "";

      // Recalculate amount based on type and percentage_basis
      let finalAmount = 0;
      if (line.other_type === "percentage") {
        // For percentage type, recalculate based on percentage_basis
        let percentage = 0;
        if (typeof line.quantity === "number") {
          percentage = line.quantity;
        } else if (line.quantity) {
          percentage = parseFloat(String(line.quantity).replace(/,/g, ""));
        }
        const percentageBasis = line.percentage_basis || "all_items";

        if (percentageBasis === "raw_material") {
          finalAmount = (wipCost * percentage) / 100;
        } else if (percentageBasis === "all_items") {
          // For "all_items", calculate percentage of total production cost
          // We need to calculate this iteratively
          // For now, use a simplified calculation
          const totals = calculateTotals();
          const totalProductionCost = totals.totalProductionCost || wipCost;
          finalAmount = (totalProductionCost * percentage) / 100;
        }
      } else {
        // For rate type (or default), use rate or amount (handle formatted numbers)
        let rateValue = 0;
        let amountValue = 0;

        if (typeof line.rate === "number") {
          rateValue = line.rate;
        } else if (line.rate) {
          rateValue = parseFloat(String(line.rate).replace(/,/g, ""));
        }

        if (typeof line.amount === "number") {
          amountValue = line.amount;
        } else if (line.amount) {
          amountValue = parseFloat(String(line.amount).replace(/,/g, ""));
        }

        finalAmount = rateValue > 0 ? rateValue : amountValue;
      }

      const hasAmount = finalAmount > 0;

      // Skip lines that don't have both Account Head and Amount
      if (!expenseAccountCode || !hasAmount) {
        return;
      }

      const isByProductCredit = line.type === "by_product_credit";

      if (isByProductCredit) {
        // For by_product_credit: Credit WIP (reduce cost), Debit the account (income/credit account)
        // Credit WIP (reduces WIP cost)
        journalEntries.push({
          transaction_date: productionDate,
          account_code: wipAccount,
          dr: 0,
          cr: finalAmount,
          transaction_description: `Production By-Product Credit - ${getSelectedBatchNo()}`,
          reference_number: getSelectedBatchNo(),
          purpose_of_payment: `By-Product Credit: ${line.description}`,
          created_by: activeBusiness.user?.id || "",
          facility_id: activeBusiness.id,
          status: "unpaid",
          type: "production",
        });

        // Debit expense/income account (credit account receives the credit)
        journalEntries.push({
          transaction_date: productionDate,
          account_code: expenseAccountCode,
          dr: finalAmount,
          cr: 0,
          transaction_description: `Production By-Product Credit - ${getSelectedBatchNo()}`,
          reference_number: getSelectedBatchNo(),
          purpose_of_payment: `By-Product Credit: ${line.description}`,
          created_by: activeBusiness.user?.id || "",
          facility_id: activeBusiness.id,
          status: "unpaid",
          type: "production",
        });
      } else {
        // For other costs: Debit WIP (add cost), Credit expense account
        // Debit WIP
        journalEntries.push({
          transaction_date: productionDate,
          account_code: wipAccount,
          dr: finalAmount,
          cr: 0,
          transaction_description: `Production Other Costs - ${getSelectedBatchNo()}`,
          reference_number: getSelectedBatchNo(),
          purpose_of_payment: `Other Cost: ${line.description}`,
          created_by: activeBusiness.user?.id || "",
          facility_id: activeBusiness.id,
          status: "unpaid",
          type: "production",
        });

        // Credit expense account
        journalEntries.push({
          transaction_date: productionDate,
          account_code: expenseAccountCode,
          dr: 0,
          cr: finalAmount,
          transaction_description: `Production Other Costs - ${getSelectedBatchNo()}`,
          reference_number: getSelectedBatchNo(),
          purpose_of_payment: `Other Cost: ${line.description}`,
          created_by: activeBusiness.user?.id || "",
          facility_id: activeBusiness.id,
          status: "unpaid",
          type: "production",
        });
      }
    });

    if (journalEntries.length === 0) {
      toast.error("Please add at least one other cost line");
      return;
    }

    // Save journal entries using insert-ledger endpoint
    _postApi(
      "/account/expenditure/record-expenses",
      {
        data: journalEntries.map((entry) => ({
          expenditure_type: entry.purpose_of_payment,
          expenditure_head: entry.account_code,
          date: entry.transaction_date,
          amount: entry.dr || entry.cr,
          narration: entry.transaction_description,
          reference_number: entry.reference_number,
          facilityId: entry.facility_id,
          head_description: entry.purpose_of_payment,
          account_description: entry.transaction_description,
        })),
        facilityId: activeBusiness.id,
        query_type: "Production",
      },
      (resp) => {
        if (resp.success) {
          toast.success("Other costs saved successfully");
          getProductionRecords();
        } else {
          toast.error(resp.message || resp.error || "Failed to save");
        }
      },
      (err) => {
        console.error("Error saving:", err);
        toast.error("Error saving other costs");
      },
    );
  };

  // Complete batch - generate Finished Goods and WIP entries
  const handleCompleteBatch = async () => {
    // Hard guard: if a batch completion/check is already in progress, ignore further clicks
    if (loadingRecords) {
      return;
    }

    // Validate Production Date input (YYYY-MM-DD) before proceeding
    if (!productionDateInput || !productionDateInput.trim()) {
      toast.error("Please enter Production Date");
      return;
    }

    const parsedProductionDate = moment(
      productionDateInput,
      "YYYY-MM-DD",
      true,
    );

    if (!parsedProductionDate.isValid()) {
      toast.error("Invalid Production Date.");
      return;
    }

    const today = moment().startOf("day");
    if (parsedProductionDate.isAfter(today)) {
      toast.error("Production Date cannot be in the future.");
      return;
    }

    // Validate form
    if (
      !recordDetails?.productionItems ||
      recordDetails.productionItems.length === 0
    ) {
      toast.error("Please add at least one production item");
      return;
    }

    // Validate production items
    // Must have at least one Finished Good and one Ingredient
    let hasFinishedGood = false;
    let hasIngredient = false;

    for (const productionItem of recordDetails.productionItems) {
      if (
        !productionItem.finishedGoods ||
        productionItem.finishedGoods.length === 0
      ) {
        toast.error(
          "Each production item must have at least one finished good",
        );
        return;
      }

      for (const fg of productionItem.finishedGoods) {
        if (!fg.finishedGood) {
          toast.error("Please select a product for all finished goods");
          return;
        }
        // Only require multiplier for process_costing
        if (
          activeBusiness?.costing_method === "process_costing" &&
          !fg.multiplier
        ) {
          toast.error("Please select a multiplier for all finished goods");
          return;
        }
        if (getCostingGoodQuantity(fg) <= 0) {
          toast.error("Please enter a valid quantity for all finished goods");
          return;
        }
        if (
          templateByProduct.branchOptions.length > 0 &&
          !templateByProduct.branchesLoading &&
          (!fg.branchLocationId ||
            fg.branchLocationId === "" ||
            String(fg.branchLocationId) === "0") &&
          !String(fg.branch_id || "").trim()
        ) {
          toast.error(
            "Please select Warehouse for each finished good product",
          );
          return;
        }
        hasFinishedGood = true;
      }

      if (
        !productionItem.ingredients ||
        productionItem.ingredients.length === 0
      ) {
        toast.error("Each production item must have at least one ingredient");
        return;
      }

      for (const ing of productionItem.ingredients) {
        if (isMaterialType(getNormalizedIngredientType(ing))) {
          if (!ing.product) {
            toast.error(
              "Please select a product from Work in progress inventory for all raw material ingredients",
            );
            return;
          }
          const sku =
            ing.rawMaterialSku ||
            ing.product?.sku ||
            ing.product?.item_code ||
            "";
          if (!sku) {
            toast.error("Raw material must have a SKU");
            return;
          }
          // Raw materials must have a valid quantity > 0
          if (!ing.quantity || parseFloat(ing.quantity) <= 0) {
            toast.error(
              "Please enter a valid quantity for all raw material ingredients",
            );
            return;
          }
          const unitCost = resolveMaterialUnitCostFromValuation(ing);
          if (unitCost <= 0) {
            toast.error(
              `Unit cost is missing for ${ing.product?.item_name || sku}. Check store entries / product default cost before completing batch.`,
            );
            return;
          }
        } else {
          // For "other" and "by_product_credit" types, quantity can be 0 if using rate-based input
          // Only validate quantity if it's percentage-based (which requires quantity > 0)
          const otherType = ing.other_type || ing.otherType || "rate";
          if (otherType === "percentage") {
            // Percentage-based items need a valid quantity > 0
            if (!ing.quantity || parseFloat(ing.quantity) <= 0) {
              toast.error(
                "Please enter a valid percentage for all percentage-based cost items",
              );
              return;
            }
          }
          // For rate-based items, quantity can be 0 (amount comes from rate field)
        }
        hasIngredient = true;
      }
    }

    // Final validation: must have at least one Finished Good and one Ingredient
    if (!hasFinishedGood) {
      const multiplierText =
        activeBusiness?.costing_method === "process_costing"
          ? ", multiplier"
          : "";
      toast.error(
        `You must have at least one Finished Good with product${multiplierText}, and quantity`,
      );
      return;
    }
    if (!hasIngredient) {
      toast.error(
        "You must have at least one Ingredient with product and quantity from Work in progress inventory",
      );
      return;
    }

    const costingTypeSubmit =
      selectedRecord?.costing_type ||
      selectedRecord?.type ||
      selectedRecord?.costingType ||
      "job_specific";
    if (
      costingTypeSubmit === "joint_shared" &&
      templateByProduct.selectedTemplateByProduct &&
      !templateByProduct.branchesLoading &&
      templateByProduct.branchOptions.length > 0 &&
      (!templateByProduct.templateByProductBranchId ||
        String(templateByProduct.templateByProductBranchId).trim() === "")
    ) {
      toast.error("Please select Warehouse for template by-product");
      return;
    }

    // Validate other costs
    // Description is not required, but Account Head and Amount are required
    // If Account Head is selected, Amount must be provided, and vice versa
    for (const line of otherCostLines || []) {
      const hasAccountHead = line.descriptionCode || line.account_code || "";
      const hasAmount = line.amount > 0;

      // If Account Head is provided, Amount must be provided
      if (hasAccountHead && !hasAmount) {
        toast.error("Please enter an amount for the selected account head");
        return;
      }

      // If Amount is provided, Account Head must be provided
      if (hasAmount && !hasAccountHead) {
        toast.error("Please select an account head for the entered amount");
        return;
      }
    }

    const varianceScanAtSubmit = computeIngredientVarianceScan(recordDetails);
    const varianceReasonMinLen = 15;
    if (varianceScanAtSubmit.hasReasonRequired) {
      const reason = ingredientVarianceWrittenReason.trim();
      if (reason.length < varianceReasonMinLen) {
        toast.error(
          `Material usage is above 5% vs expected on one or more lines. Enter a written reason (at least ${varianceReasonMinLen} characters) before posting.`,
        );
        return;
      }
    }
    if (varianceScanAtSubmit.hasSupervisorReview) {
      const confirmed = window.confirm(
        "One or more materials have between 2% and 5% variance vs expected usage. This flags the batch for supervisor review. Continue with Complete Batch?",
      );
      if (!confirmed) {
        return;
      }
    }

    // Check WIP inventory availability before submission
    setLoadingRecords(true);

    // Collect all ingredients with their product IDs and required quantities
    const ingredientRequirements = [];
    const productIds = [];

    (recordDetails?.productionItems || []).forEach((productionItem) => {
      productionItem.ingredients?.forEach((ing) => {
        if (ing.product) {
          const productId =
            ing.product.product_id ||
            ing.product.id ||
            ing.product.item_code ||
            ing.product.sku ||
            ing.product.itemCode ||
            "";
          const requiredQty = (() => {
            const manual =
              ing.actualQuantity ?? ing.actual_qty ?? ing.actualQty;
            const raw = ing.isActualQtyManuallySet
              ? (manual ?? "")
              : (manual ?? ing.qtyUsed ?? ing.qty_used ?? manual);
            const parsed = parseFloat(String(raw ?? "").replace(/,/g, ""));
            if (Number.isFinite(parsed)) return parsed;
            return parseFloat(ing.quantity || 0) || 0;
          })();

          if (productId && requiredQty > 0) {
            if (!productIds.includes(productId)) {
              productIds.push(productId);
            }
            ingredientRequirements.push({
              product_id: productId,
              requiredQty: requiredQty,
              productName: ing.product.item_name || ing.product.name || "",
              unitOfMeasure:
                ing.unitOfMeasure || ing.product.unit_of_measure || "",
            });
          }
        }
      });
    });

    const wipCode = activeBusiness?.wip;
    if (!wipCode) {
      toast.error(
        "WIP account code is not configured. Please configure it in business settings.",
      );
      setLoadingRecords(false);
      return;
    }

    const productionDateStr = moment(
      productionDateInput,
      "YYYY-MM-DD",
      true,
    ).format("YYYY-MM-DD");

    const resolveBusinessAccount = (fieldName, fallbackDescription) => {
      const direct = activeBusiness?.[fieldName];
      if (direct != null && String(direct).trim() !== "") {
        return String(direct).trim();
      }
      if (
        fieldName === "abnormal_loss_account" &&
        productionDefaultAccounts?.abnormalLossAccount?.code
      ) {
        return String(
          productionDefaultAccounts.abnormalLossAccount.code,
        ).trim();
      }
      if (
        fieldName === "scrap_inventory_account" &&
        productionDefaultAccounts?.scrapInventoryAccount?.code
      ) {
        return String(
          productionDefaultAccounts.scrapInventoryAccount.code,
        ).trim();
      }
      const match = (expenseList || []).find(
        (e) =>
          String(e.name || "")
            .trim()
            .toLowerCase() === fallbackDescription.toLowerCase(),
      );
      return match?.code ? String(match.code).trim() : "";
    };

    let wasteJournalBlocked = false;
    const wasteJournalEntries = [];
    const recyclableWasteStoreLines = [];

    const costingType =
      selectedRecord?.costing_type || selectedRecord?.type || "job_specific";

    const previewFgDrBySku = new Map();
    if (costingType === "joint_shared" && jointSharedJournalPreview?.rows) {
      for (const row of jointSharedJournalPreview.rows) {
        if (row.section === "production" && row.dr > 0) {
          const skuKey = String(row.productSku || "").trim();
          if (skuKey) previewFgDrBySku.set(skuKey, row.dr);
        }
      }
    }

    // Transform products array
    const products = (recordDetails?.productionItems || []).map(
      (productionItem, idx) => {
        console.log(`\n=== Production Item #${idx + 1} ===`);
        console.log(
          "Raw ingredients:",
          JSON.stringify(productionItem.ingredients, null, 2),
        );

        let wastePayloadObject = null;

        // Transform finished goods
        // Build finished goods array for this production item
        const finishedGoods = (productionItem.finishedGoods || [])
          .map((fg) => {
            if (!fg.finishedGood) return null;

            const sku =
              fg.finishedGood.item_code ||
              fg.finishedGood.itemCode ||
              fg.finishedGood.sku ||
              fg.finishedGood.SKU ||
              "";

            const multiplierId = fg.multiplier?.id || null;
            const quantity = getCostingGoodQuantity(fg);

            let multiplierValue = 1.0;
            if (fg.multiplier?.multiplier_value) {
              multiplierValue = parseFloat(fg.multiplier.multiplier_value);
            } else if (
              fg.multiplierValue &&
              parseFloat(fg.multiplierValue) !== 1.0
            ) {
              multiplierValue = parseFloat(fg.multiplierValue);
            }

            // Journal unit cost: same rate for FG and waste (abnormal/recyclable) so WIP balances.
            const journalUnitCost = getJournalUnitCostForPosting(
              productionItem,
              fg,
            );
            const costPerUnit = computeProductionCostPerUnit(productionItem);

            const wasteQty =
              parseFloat(fg.wasteQuantity ?? fg.waste_quantity ?? 0) || 0;
            const wasteTypeNorm = String(
              fg.wasteType ?? fg.waste_type ?? "normal",
            )
              .trim()
              .toLowerCase();

            let fgCpuForPosting = journalUnitCost;
            let scrapSellingForWastePayload = 0;
            let scrapMarkUpForWastePayload = 0;
            let scrapMarkupModeForWastePayload =
              fg.wasteScrapMarkupMode === "fixed" ? "fixed" : "percentage";
            let vatRateForWastePayload =
              fg.wasteScrapApplyVat === false
                ? 0
                : parseFloat(
                    String(
                      fg.wasteScrapVatRate ?? fg.vat_rate ?? "7.5",
                    ).replace(/,/g, ""),
                  ) || 7.5;
            let applyVatForWastePayload = fg.wasteScrapApplyVat !== false;

            // Abnormal / recyclable: Dr loss or scrap = journalUnitCost × waste qty; Cr WIP (same amount).

            if (wasteQty > 0 && wasteTypeNorm === "recyclable") {
              const scrapSel = fg.wasteScrapByProductSelection?.[0];
              const scrapSkuPick =
                scrapSel?.sku ||
                scrapSel?.item_code ||
                scrapSel?.itemCode ||
                scrapSel?.SKU ||
                "";
              if (!String(scrapSkuPick).trim()) {
                toast.error(
                  "Select a by-product (scrap) item for recyclable waste so inventory can be received on the correct SKU.",
                );
                wasteJournalBlocked = true;
                return null;
              }
              if (!String(scrapSel?.inventory_account || "").trim()) {
                toast.error(
                  "Selected scrap/by-product must have an inventory account on the product record.",
                );
                wasteJournalBlocked = true;
                return null;
              }
              const batchNoRef = getSelectedBatchNo();
              const wasteCost = Number((wasteQty * journalUnitCost).toFixed(2));
              const unitCpu = journalUnitCost;
              const manualSp = parseFloat(
                String(fg.wasteScrapSellingPrice ?? "").replace(/,/g, ""),
              );
              const computedSp = calculateScrapSellingPriceForStore(
                unitCpu,
                fg,
              );
              const sellingPriceOut =
                Number.isFinite(manualSp) && manualSp > 0
                  ? manualSp
                  : computedSp;
              const scrapMarkUpNum =
                parseFloat(
                  String(fg.wasteScrapMarkUp ?? "").replace(/,/g, ""),
                ) || 0;
              const scrapMarkupModeOut =
                fg.wasteScrapMarkupMode === "fixed" ? "fixed" : "percentage";
              const vatR =
                fg.wasteScrapApplyVat === false
                  ? 0
                  : parseFloat(
                      String(fg.wasteScrapVatRate ?? "").replace(/,/g, ""),
                    ) || 7.5;
              scrapSellingForWastePayload = sellingPriceOut;
              scrapMarkUpForWastePayload = scrapMarkUpNum;
              scrapMarkupModeForWastePayload = scrapMarkupModeOut;
              vatRateForWastePayload = vatR;
              applyVatForWastePayload = fg.wasteScrapApplyVat !== false;
              recyclableWasteStoreLines.push({
                scrap_sku: String(scrapSkuPick).trim(),
                inventory_account_code: String(
                  scrapSel.inventory_account,
                ).trim(),
                fg_sku: sku,
                quantity: wasteQty,
                cost_amount: wasteCost,
                selling_price: sellingPriceOut,
                mark_up: scrapMarkUpNum,
                markup_mode: scrapMarkupModeOut,
                vat_rate: vatR,
                apply_vat: fg.wasteScrapApplyVat !== false,
                batch_ref: batchNoRef,
              });
            }

            // amount = journalUnitCost × good qty; waste GL = journalUnitCost × waste qty
            const costPerUnitRounded = parseFloat(
              parseFloat(fgCpuForPosting).toFixed(2),
            );
            const previewFgDr = previewFgDrBySku.get(sku);
            const lineAmount =
              previewFgDr != null && previewFgDr > 0
                ? Number(previewFgDr.toFixed(2))
                : parseFloat((costPerUnitRounded * quantity).toFixed(2));
            const costPerUnitForPosting =
              quantity > 0
                ? Number((lineAmount / quantity).toFixed(4))
                : costPerUnitRounded;

            const wasteAmountPayload = Number(
              (wasteQty > 0 ? wasteQty * costPerUnitForPosting : 0).toFixed(2),
            );
            const wasteUnitCostPayload = costPerUnitForPosting;
            const wasteGlAmount =
              wasteQty > 0 &&
              (wasteTypeNorm === "abnormal" || wasteTypeNorm === "recyclable")
                ? wasteAmountPayload
                : 0;

            if (wasteQty > 0) {
              const abSel = fg.wasteAbnormalLossExpenseSelection?.[0];
              const scrapSel = fg.wasteScrapByProductSelection?.[0];
              const scrapSkuPick =
                scrapSel?.sku ||
                scrapSel?.item_code ||
                scrapSel?.itemCode ||
                scrapSel?.SKU ||
                "";

              let line;
              if (wasteTypeNorm === "normal") {
                line = {
                  wasteType: "normal",
                  wasteQuantity: wasteQty,
                  wasteReason: fg.wasteReason || "",
                  sku,
                  multiplier_id: multiplierId,
                  cost_per_unit: wasteUnitCostPayload,
                  amount: wasteAmountPayload,
                  waste_gl_amount: wasteGlAmount,
                };
              } else if (wasteTypeNorm === "abnormal") {
                line = {
                  wasteType: "abnormal",
                  wasteQuantity: wasteQty,
                  wasteReason: fg.wasteReason || "",
                  sku,
                  multiplier_id: multiplierId,
                  abnormal_loss_account_code:
                    abSel?.code != null && String(abSel.code).trim() !== ""
                      ? String(abSel.code).trim()
                      : null,
                  abnormal_loss_account_name:
                    abSel?.name != null ? String(abSel.name) : null,
                  cost_per_unit: wasteUnitCostPayload,
                  waste_gl_amount: wasteGlAmount,
                  amount: wasteAmountPayload,
                };
              } else {
                line = {
                  wasteType: "recyclable",
                  wasteQuantity: wasteQty,
                  wasteReason: fg.wasteReason || "",
                  sku,
                  multiplier_id: multiplierId,
                  scrap: scrapSel
                    ? {
                        sku: String(scrapSkuPick || "").trim() || null,
                        item_name:
                          scrapSel.item_name ||
                          scrapSel.name ||
                          scrapSel.itemName ||
                          null,
                        inventory_account_code:
                          String(scrapSel.inventory_account || "").trim() ||
                          null,
                      }
                    : null,
                  scrap_cost_per_unit: wasteUnitCostPayload,
                  scrap_selling_price: scrapSellingForWastePayload,
                  scrap_mark_up: scrapMarkUpForWastePayload,
                  scrap_markup_mode: scrapMarkupModeForWastePayload,
                  scrap_vat_rate: vatRateForWastePayload,
                  scrap_apply_vat: applyVatForWastePayload,
                  waste_gl_amount: wasteGlAmount,
                  amount: wasteAmountPayload,
                  cost_per_unit: wasteUnitCostPayload,
                };
              }

              if (!wastePayloadObject) {
                wastePayloadObject = line;
              } else if (
                String(wastePayloadObject.sku || "").trim() ===
                String(line.sku || "").trim()
              ) {
                const wq =
                  (parseFloat(wastePayloadObject.wasteQuantity) || 0) +
                  wasteQty;
                const amt =
                  (parseFloat(wastePayloadObject.amount) || 0) +
                  wasteAmountPayload;
                const gl =
                  (parseFloat(wastePayloadObject.waste_gl_amount) || 0) +
                  wasteGlAmount;
                const mergedCpu =
                  wq > 0 ? Number((amt / wq).toFixed(4)) : line.cost_per_unit;
                wastePayloadObject = {
                  ...wastePayloadObject,
                  wasteQuantity: wq,
                  amount: Number(amt.toFixed(2)),
                  waste_gl_amount: Number(gl.toFixed(2)),
                  cost_per_unit: mergedCpu,
                };
                if (wastePayloadObject.wasteType === "recyclable") {
                  wastePayloadObject.scrap_cost_per_unit = mergedCpu;
                  if (
                    line.scrap_selling_price != null &&
                    line.scrap_selling_price > 0
                  ) {
                    wastePayloadObject.scrap_selling_price =
                      line.scrap_selling_price;
                  }
                }
              } else {
                console.warn(
                  "[production] Multiple waste SKUs on one line item; keeping first waste object only.",
                );
              }
            }

            return {
              sku: sku,
              multiplier_id: multiplierId,
              cost_per_unit: costPerUnitForPosting,
              qty: quantity,
              goodQuantity: quantity,
              wasteQuantity:
                wasteQty > 0 ? 0 : parseFloat(fg.wasteQuantity || 0) || 0,
              wasteType: wasteQty > 0 ? "" : wasteTypeNorm,
              wasteReason: wasteQty > 0 ? "" : fg.wasteReason || "",
              waste_gl_amount: 0,
              amount: lineAmount,
              mark_up: parseFloat(fg.mark_up) || 0,
              markup_mode: fg.markup_mode || "percentage",
              vat_rate:
                fg.apply_vat === false ? 0 : parseFloat(fg.vat_rate) || 7.5,
              apply_vat: fg.apply_vat === false ? false : true,
              taxable: fg?.finishedGood?.taxable || "Non-Taxable",
              selling_price: calculateFinishedGoodSellingPrice(
                costPerUnitForPosting,
                fg,
              ),
              expiry_date: fg.expiry_date || null,
              branchLocationId: fg.branchLocationId ?? null,
              branch_id: fg.branch_id ?? "",
              branch_name: "for sales",
            };
          })
          .filter(Boolean);

        // Calculate total finished goods quantity for this production item
        // Use the transformed finishedGoods array to get the actual qty values
        const totalFinishedGoodsQty = finishedGoods.reduce((sum, fg) => {
          // Use qty from transformed finishedGoods (which has the actual quantity)
          return sum + parseFloat(fg.qty || 0);
        }, 0);

        // Transform ingredients - ingredients are nested under each product
        const ingredients = (productionItem.ingredients || []).map((ing) => {
          // Get base quantity (per unit) - this is what we'll send in the request
          const baseIngredientQty = parseFloat(ing.quantity || 0);
          const exactQuantityUsed = totalFinishedGoodsQty * baseIngredientQty;

          const derivedExpectedForPosting =
            getRecordProductionStyleIngredientExpectedQty(
              productionItem.finishedGoods || [],
              ing,
            );
          let expectedQtyOut = parseOptionalPostingQty(
            ing.expectedQuantity ?? ing.expected_qty ?? ing.expectedQty,
          );
          if (expectedQtyOut == null && derivedExpectedForPosting != null) {
            expectedQtyOut = derivedExpectedForPosting;
          }
          let actualQtyOut = parseOptionalPostingQty(
            getStoredMaterialActualQtyRaw(ing),
          );
          if (
            derivedExpectedForPosting != null &&
            isMaterialType(getNormalizedIngredientType(ing))
          ) {
            expectedQtyOut = derivedExpectedForPosting;
          }
          if (actualQtyOut == null && expectedQtyOut != null) {
            actualQtyOut = expectedQtyOut;
          }

          console.log("Processing ingredient:", {
            type: ing.type,
            product: ing.product,
            baseQuantity: baseIngredientQty,
            finishedGoodsQty: totalFinishedGoodsQty,
            exactQuantityUsed: exactQuantityUsed,
            description: ing.description,
            descriptionCode: ing.descriptionCode,
            account_head: ing.account_head,
            other_type: ing.other_type,
            rate: ing.rate,
          });

          if (isMaterialType(getNormalizedIngredientType(ing))) {
            const unitCost = isMaterialType(getNormalizedIngredientType(ing))
              ? resolveMaterialUnitCost(ing)
              : parseJournalStyleAmount(ing.unit_cost) ||
                parseJournalStyleAmount(ing.cost_price) ||
                parseJournalStyleAmount(ing.product?.unit_cost) ||
                parseJournalStyleAmount(ing.product?.cost_price) ||
                0;
            const qtyForAmount = (() => {
              if (
                derivedExpectedForPosting != null &&
                isMaterialType(getNormalizedIngredientType(ing))
              ) {
                return derivedExpectedForPosting;
              }
              if (actualQtyOut != null) return actualQtyOut;
              if (expectedQtyOut != null) return expectedQtyOut;
              return exactQuantityUsed;
            })();
            const lineBasis =
              parseOptionalPostingQty(
                ing.basis ?? ing.rate_basis ?? ing.rateBasis ?? ing.line_basis,
              ) ?? 1;
            const exactAmount = parseFloat(
              ((qtyForAmount * unitCost) / lineBasis).toFixed(2),
            );

            const matType = getNormalizedIngredientType(ing);

            return {
              type: matType,
              description: ing.description || ing.product?.item_name || "",
              descriptionCode:
                ing.descriptionCode || ing.description_code || "",
              accountHead: ing.accountHead || ing.account_head || "",
              quantity: baseIngredientQty, // Send base quantity (per unit), not exact quantity
              rawMaterialId:
                ing.rawMaterialId ||
                ing.product?.id ||
                ing.product?.item_code ||
                "",
              rawMaterialName:
                ing.rawMaterialName || ing.product?.item_name || "",
              rawMaterialSku:
                ing.rawMaterialSku ||
                ing.product?.sku ||
                ing.product?.item_code ||
                "",
              otherType: ing.otherType || ing.other_type || "rate",
              rate: ing.rate || "",
              percentageBasis:
                ing.percentageBasis || ing.percentage_basis || "all_items",
              unit_cost: unitCost,
              amount: exactAmount, // Send exact amount (unit_cost * exact quantity used for total batch)
              ...(expectedQtyOut != null
                ? { expected_qty: expectedQtyOut }
                : {}),
              ...(actualQtyOut != null ? { actual_qty: actualQtyOut } : {}),
            };
          } else {
            const inputType = ing.otherType || ing.other_type || "rate";
            let amount = 0;
            if (inputType === "rate") {
              amount = getOtherRateLineAmount(
                productionItem,
                ing.rate || 0,
              );
            } else {
              amount =
                parseFloat(ing.amount || 0) || parseFloat(ing.rate || 0);
            }

            return {
              type: ing.type,
              description: ing.description || "",
              descriptionCode:
                ing.descriptionCode || ing.description_code || "",
              accountHead: ing.accountHead || ing.account_head || "",
              quantity: parseFloat(ing.quantity || 0),
              rawMaterialId: "",
              rawMaterialName: "",
              rawMaterialSku: "",
              otherType: ing.otherType || ing.other_type || "rate",
              rate: ing.rate || "",
              percentageBasis:
                ing.percentageBasis || ing.percentage_basis || "all_items",
              unit_cost: 0,
              amount: amount,
              ...(expectedQtyOut != null
                ? { expected_qty: expectedQtyOut }
                : {}),
              ...(actualQtyOut != null ? { actual_qty: actualQtyOut } : {}),
            };
          }
        });

        // For the payload send every finished-good line (with or without waste) so the API
        // can post FG receipts for all outputs. Ingredient consumption is applied once per
        // production item using total good quantity (see completeProduction).
        const finishedGoodsPayload =
          finishedGoods.length > 0 ? finishedGoods : null;

        return {
          id: productionItem.id,
          units: productionItem.units || 0,
          finishedGoods: finishedGoodsPayload,
          waste: wastePayloadObject,
          ingredients,
        };
      },
    );

    if (wasteJournalBlocked) {
      setLoadingRecords(false);
      return;
    }

    // Transform shared costs (for joint_shared only)
    const transformedSharedCosts =
      costingType === "joint_shared"
        ? (sharedCosts || []).map((line) => {
            // Get unit_cost - use stored value first, then product, then calculate from amount/quantity
            let unitCost = 0;
            if (line.type === "raw_material") {
              unitCost =
                parseFloat(line.unit_cost) ||
                parseFloat(line.cost_price) ||
                parseFloat(line.product?.unit_cost) ||
                parseFloat(line.product?.cost_price) ||
                0;
              // If unit_cost is still 0 but we have amount and quantity, calculate it
              if (
                unitCost === 0 &&
                line.amount &&
                line.quantity &&
                parseFloat(line.quantity) > 0
              ) {
                unitCost = parseFloat(line.amount) / parseFloat(line.quantity);
              }
            }

            // Get otherType - check both camelCase and snake_case
            const otherType = line.otherType || line.other_type || "rate";

            // Get amount - use stored value first, then calculate from rate
            let amount = parseFloat(line.amount || 0);
            if (amount === 0) {
              amount = parseFloat(line.rate || 0);
            }

            const recipeQty = getSharedCostRecipeQty(line);

            return {
              type: line.type || "other",
              description: line.description || "",
              descriptionCode:
                line.descriptionCode || line.description_code || "",
              accountHead: line.accountHead || line.account_head || "",
              quantity: recipeQty,
              expectedQuantity: recipeQty,
              expected_qty: getSharedCostExpectedTotal(line, sharedCostQtyUse),
              actualQty: getSharedCostActualTotal(line, sharedCostQtyUse),
              actual_qty: getSharedCostActualTotal(line, sharedCostQtyUse),
              isActualQtyManuallySet: Boolean(line.isActualQtyManuallySet),
              rawMaterialId: line.rawMaterialId || line.rawMaterial_id || "",
              rawMaterialName:
                line.rawMaterialName || line.rawMaterial_name || "",
              rawMaterialSku: line.rawMaterialSku || line.rawMaterial_sku || "",
              otherType: otherType,
              rate: line.rate || "",
              percentageBasis:
                line.percentageBasis || line.percentage_basis || "all_items",
              unit_cost: unitCost,
              amount: amount,
            };
          })
        : undefined;

    const varianceScanForPayload = computeIngredientVarianceScan(recordDetails);

    const requestData = {
      costingType: costingType,
      costingRecordId: selectedRecord?.id || null,
      batchNo: getSelectedBatchNo(),
      batchId: selectedRecord?.batch_id || selectedRecord?.batch_no || null,
      productionDate: productionDateStr,
      departmentId: null,
      branchId: targetBranch || 0,
      products,
      ...(varianceScanForPayload.flaggedLines.length > 0 && {
        ingredientVariance: {
          thresholdsPercent:
            "0-2 acceptable auto-approve; 2-5 supervisor review; above-5 written reason required",
          flaggedLines: varianceScanForPayload.flaggedLines,
          ...(varianceScanForPayload.hasReasonRequired
            ? {
                writtenReason: ingredientVarianceWrittenReason.trim(),
              }
            : {}),
        },
      }),
      ...(costingType === "joint_shared" && {
        output: sharedCostOutputPercentage || 1,
        qtyUse: sharedCostQtyUse || 1,
        sharedCosts: transformedSharedCosts,
        ...(() => {
          const tbpPayload = templateByProduct.buildTemplateByProductPayload();
          return tbpPayload ? { templateByProduct: tbpPayload } : {};
        })(),
      }),
    };

    _postApi(
      "/account/post-bulk-production",
      {
        requestData,
        facilityId: activeBusiness.id,
        userId: user.id,
        wipCode: wipCode,
        journalEntries: wasteJournalEntries,
        ...(costingType === "joint_shared" &&
          jointSharedJournalPreview?.rows?.length > 0 && {
            sharedCostingLedgerEntries: mapJointSharedPreviewToLedgerPayload(
              jointSharedJournalPreview,
              wipCode,
              {
                productionItems: recordDetails?.productionItems || [],
                productCatalog: finishedGoodProducts,
              },
            ),
          }),
        abnormal_loss_account: (() => {
          const scanFg = (fg) => {
            const wt = String(fg.wasteType ?? fg.waste_type ?? "")
              .trim()
              .toLowerCase();
            const code =
              fg.wasteAbnormalLossExpenseSelection?.[0]?.code != null &&
              String(fg.wasteAbnormalLossExpenseSelection[0].code).trim() !== ""
                ? String(fg.wasteAbnormalLossExpenseSelection[0].code).trim()
                : "";
            if (wt === "abnormal" && code) return code;
            return null;
          };
          const scanWaste = (w) => {
            if (w == null) return null;
            if (Array.isArray(w)) {
              for (const fg of w) {
                const hit = scanFg(fg);
                if (hit) return hit;
              }
              return null;
            }
            if (typeof w === "object") {
              const wt = String(w.wasteType ?? w.waste_type ?? "")
                .trim()
                .toLowerCase();
              if (wt === "abnormal") {
                const code = String(
                  w.abnormal_loss_account_code ??
                    w.abnormalLossAccountCode ??
                    "",
                ).trim();
                if (code) return code;
              }
              return scanFg(w);
            }
            return null;
          };
          for (const pi of recordDetails?.productionItems || []) {
            for (const fg of pi.finishedGoods || []) {
              const hit = scanFg(fg);
              if (hit) return hit;
            }
            const hit = scanWaste(pi.waste);
            if (hit) return hit;
          }
          return resolveBusinessAccount(
            "abnormal_loss_account",
            "Abnormal Loss",
          );
        })(),
        scrap_inventory_account: (() => {
          const scanFg = (fg) => {
            const wt = String(fg.wasteType ?? fg.waste_type ?? "")
              .trim()
              .toLowerCase();
            const code =
              fg.wasteScrapByProductSelection?.[0]?.inventory_account != null &&
              String(
                fg.wasteScrapByProductSelection[0].inventory_account,
              ).trim() !== ""
                ? String(
                    fg.wasteScrapByProductSelection[0].inventory_account,
                  ).trim()
                : "";
            if (wt === "recyclable" && code) return code;
            return null;
          };
          const scanWaste = (w) => {
            if (w == null) return null;
            if (Array.isArray(w)) {
              for (const fg of w) {
                const hit = scanFg(fg);
                if (hit) return hit;
              }
              return null;
            }
            if (typeof w === "object") {
              const wt = String(w.wasteType ?? w.waste_type ?? "")
                .trim()
                .toLowerCase();
              if (
                wt === "recyclable" &&
                w.scrap &&
                typeof w.scrap === "object"
              ) {
                const code = String(
                  w.scrap.inventory_account_code ??
                    w.scrap.inventory_account ??
                    "",
                ).trim();
                if (code) return code;
              }
              return scanFg(w);
            }
            return null;
          };
          for (const pi of recordDetails?.productionItems || []) {
            for (const fg of pi.finishedGoods || []) {
              const hit = scanFg(fg);
              if (hit) return hit;
            }
            const hit = scanWaste(pi.waste);
            if (hit) return hit;
          }
          return resolveBusinessAccount(
            "scrap_inventory_account",
            "Scrap Inventory",
          );
        })(),
        recyclableWasteStoreLines,
      },
      (resp) => {
        setLoadingRecords(false);
        if (resp.success) {
          toast.success("Batch completed and journal entries created");
          navigate("/app/sales/markup");
          setSelectedRecord(null);
          setRecordDetails(null);
          getProductionRecords();
        } else {
          toast.error(resp.message || "Failed to complete batch");
        }
      },
      (err) => {
        setLoadingRecords(false);
        console.error("Error completing batch:", err);
        toast.error(
          err?.message || err?.error || "Error completing batch",
        );
      },
    );
  };
  // Fetch data when tab changes
  useEffect(() => {
    // Only fetch if activeBusiness is available
    if (!activeBusiness?.id) return;

    if (activeTab === "markup") {
      getMarkupData();
    } else if (activeTab === "price-edit") {
      getPriceEditData();
    } else if (activeTab === "costing") {
      getProductionRecords();
      getExpenseList();
      fetchFinishedGoodProducts();
      fetchRawMaterialProducts();
      fetchProductGroups();
    }
  }, [
    activeTab,
    activeBusiness?.id,
    getMarkupData,
    getPriceEditData,
    getProductionRecords,
    getExpenseList,
    fetchFinishedGoodProducts,
    fetchRawMaterialProducts,
    fetchProductGroups,
  ]);

  // Refresh shared-cost raw materials with live WIP balances
  useEffect(() => {
    setSharedCosts((prev) => {
      if (!prev.length) return prev;

      let changed = false;
      const next = prev.map((cost) => {
        if ((cost.type || "raw_material") !== "raw_material") return cost;

        const resolved = resolveLiveWipProductForSharedCost(
          cost,
          rawMaterialProducts,
        );
        const live = resolved.product;
        if (!live) return cost;

        const avail = resolved.matchedInWip ? getRmAvailableQty(live) : 0;
        const sameRef =
          live === cost.product ||
          (cost.product &&
            String(cost.product.item_name || cost.product.name || "") ===
              String(live.item_name || live.name || "") &&
            String(cost.product.item_code || cost.product.sku || "") ===
              String(live.item_code || live.sku || ""));
        const sameAvail =
          Number(cost.availableQty || 0) === avail &&
          Boolean(cost.isOutOfWipStock) === !resolved.matchedInWip;

        if (sameRef && sameAvail && cost.product) return cost;

        changed = true;
        return {
          ...cost,
          product: live,
          availableQty: avail,
          isOutOfWipStock: !resolved.matchedInWip,
          rawMaterialId:
            cost.rawMaterialId || live.product_id || live.id || "",
          rawMaterialSku:
            cost.rawMaterialSku || live.item_code || live.sku || "",
          rawMaterialName:
            cost.rawMaterialName || live.item_name || live.name || "",
          description:
            cost.description || live.item_name || live.name || "",
        };
      });

      if (!changed) return prev;

      return calculateSharedCostAmounts(
        next,
        sharedCostQtyUse,
        parseJournalStyleAmount,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaterialProducts]);

  // Update shared costs with products when rawMaterialProducts are loaded
  useEffect(() => {
    if (
      selectedProductGroup &&
      rawMaterialProducts.length > 0 &&
      sharedCosts.length > 0
    ) {
      const updatedCosts = sharedCosts.map((cost) => {
        if (cost.type === "raw_material" && !cost.product) {
          const foundProduct = rawMaterialProducts.find(
            (rm) =>
              String(rm.product_id) === String(cost.rawMaterialId) ||
              String(rm.item_code) === String(cost.rawMaterialSku) ||
              rm.item_name === cost.description,
          );
          if (foundProduct) {
            return {
              ...cost,
              product: foundProduct,
              unit_cost: getSharedCostUnitCost(cost.rate, foundProduct),
              availableQty: getRmAvailableQty(foundProduct),
            };
          }
        }
        return cost;
      });
      const hasChanges = updatedCosts.some(
        (cost, index) => cost.product !== sharedCosts[index]?.product,
      );
      if (hasChanges) {
        setSharedCosts(updatedCosts);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaterialProducts, selectedProductGroup]);

  // Update shared costs with products when rawMaterialProducts are loaded for selected record
  useEffect(() => {
    if (
      selectedRecord &&
      rawMaterialProducts.length > 0 &&
      sharedCosts.length > 0
    ) {
      const isJointShared =
        selectedRecord.costing_type === "joint_shared" ||
        selectedRecord.type === "joint_shared" ||
        selectedRecord.costingType === "joint_shared";

      if (isJointShared) {
        const updatedCosts = sharedCosts.map((cost) => {
          if ((cost.type || "raw_material") !== "raw_material") return cost;

          const resolved = resolveLiveWipProductForSharedCost(
            cost,
            rawMaterialProducts,
          );
          if (!resolved.product) return cost;

          const avail = resolved.matchedInWip
            ? getRmAvailableQty(resolved.product)
            : 0;
          const needsProduct = !cost.product;
          const needsWipRefresh =
            Boolean(cost.isOutOfWipStock) !== !resolved.matchedInWip ||
            Number(cost.availableQty || 0) !== avail;
          const needsCost =
            !cost.unit_cost ||
            cost.unit_cost === 0 ||
            cost.unit_cost === "0";

          if (!needsProduct && !needsWipRefresh && !needsCost) return cost;

          return {
            ...cost,
            product: resolved.product,
            availableQty: avail,
            isOutOfWipStock: !resolved.matchedInWip,
            unit_cost: needsCost
              ? getSharedCostUnitCost(cost.rate, resolved.product)
              : cost.unit_cost,
            rawMaterialId:
              cost.rawMaterialId ||
              resolved.product.product_id ||
              resolved.product.id ||
              "",
            rawMaterialSku:
              cost.rawMaterialSku ||
              resolved.product.item_code ||
              resolved.product.sku ||
              "",
            rawMaterialName:
              cost.rawMaterialName ||
              resolved.product.item_name ||
              resolved.product.name ||
              "",
          };
        });
        const hasChanges = updatedCosts.some(
          (cost, index) =>
            cost.product !== sharedCosts[index]?.product ||
            cost.unit_cost !== sharedCosts[index]?.unit_cost ||
            cost.availableQty !== sharedCosts[index]?.availableQty ||
            cost.isOutOfWipStock !== sharedCosts[index]?.isOutOfWipStock,
        );
        if (hasChanges) {
          console.log(
            "Updating shared costs with product information:",
            updatedCosts,
          );
          setSharedCosts(updatedCosts);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMaterialProducts, selectedRecord]);

  // Refresh raw material rates when WIP loads (valuation) or product default cost is missing
  useEffect(() => {
    if (!selectedRecord?.id || !rawMaterialProducts.length) return;

    setRecordDetails((prev) => {
      if (!prev?.productionItems?.length) return prev;

      let changed = false;
      const productionItems = prev.productionItems.map((item) => ({
        ...item,
        ingredients: item.ingredients.map((ing) => {
          const ingType = ing?.type || "raw_material";
          const productItemType = String(
            ing?.product?.item_type || "",
          ).toLowerCase();
          const isMaterial =
            ingType === "raw_material" ||
            ingType === "semi_finished" ||
            productItemType === "semi finished";
          if (!isMaterial) return ing;

          const product = findRawMaterialProductForIngredient(ing);
          if (!product) return ing;

          const newCost = resolveMaterialUnitCostFromValuation({
            ...ing,
            product,
          });
          const prevCost = parseJournalStyleAmount(ing.unit_cost);

          if (usesSystemValuation()) {
            if (newCost <= 0 && prevCost > 0) return ing;
          } else {
            if (prevCost > 0) return ing;
            const templateRate = getMaterialTemplateRate(ing);
            const templateNum = parseFloat(templateRate);
            if (
              templateRate != null &&
              templateRate !== "" &&
              !isNaN(templateNum) &&
              templateNum > 0
            ) {
              return ing;
            }
          }

          if (newCost <= 0) return ing;
          if (Math.abs(prevCost - newCost) < 0.0001) return ing;

          changed = true;
          return {
            ...ing,
            product,
            unit_cost: formatNumberWithCommas(String(newCost)),
            cost_price: newCost,
          };
        }),
      }));

      if (!changed) return prev;
      return { ...prev, productionItems };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valuation helpers read activeBusiness + WIP list
  }, [
    rawMaterialProducts,
    selectedRecord?.id,
    activeBusiness?.default_valuation_source,
  ]);

  // Resolve finished good product labels once the catalog loads (or after record open).
  useEffect(() => {
    if (!selectedRecord?.id || !finishedGoodProducts.length) return;

    setRecordDetails((prev) => {
      if (!prev?.productionItems?.length) return prev;

      let changed = false;
      const productionItems = prev.productionItems.map((item) => ({
        ...item,
        finishedGoods: (item.finishedGoods || []).map((fg) => {
          const enriched = enrichFinishedGoodRowWithProductContext(fg, item);
          const resolved = resolveFinishedGoodFromFgRow(
            enriched,
            finishedGoodProducts,
          );
          if (!resolved) return fg;

          const prevGood = fg.finishedGood;
          const needsUpdate =
            !prevGood ||
            !productsShareIdentity(prevGood, resolved) ||
            !(prevGood.item_name || prevGood.name) ||
            normProductKey(prevGood.item_code || prevGood.sku) !==
              normProductKey(resolved.item_code || resolved.sku);

          if (!needsUpdate) return fg;

          changed = true;
          return {
            ...fg,
            finishedGood: resolved,
            unitOfMeasure: fg.unitOfMeasure || resolved.unit_of_measure || "",
            category: fg.category || resolved.category || "",
          };
        }),
      }));

      return changed ? { ...prev, productionItems } : prev;
    });
  }, [finishedGoodProducts, selectedRecord?.id]);

  const fetchedMultiplierSkusRef = useRef(new Set());

  useEffect(() => {
    fetchedMultiplierSkusRef.current = new Set();
  }, [selectedRecord?.id]);

  // Fetch product multipliers once finished goods are resolved from the catalog.
  useEffect(() => {
    if (
      !selectedRecord?.id ||
      !recordDetails?.productionItems?.length ||
      !activeBusiness?.id
    ) {
      return;
    }

    const skus = new Set();
    recordDetails.productionItems.forEach((item) => {
      (item.finishedGoods || []).forEach((fg) => {
        const product = resolveFinishedGoodFromFgRow(fg, finishedGoodProducts);
        const sku =
          product?.item_code ||
          product?.itemCode ||
          product?.sku ||
          fg.sku ||
          fg.productSku;
        if (sku) skus.add(String(sku));
      });
    });

    skus.forEach((sku) => {
      if (fetchedMultiplierSkusRef.current.has(sku)) return;
      fetchedMultiplierSkusRef.current.add(sku);
      fetchProductsWithMultipliers(sku);
    });
  }, [
    selectedRecord?.id,
    recordDetails?.productionItems,
    finishedGoodProducts,
    activeBusiness?.id,
    fetchProductsWithMultipliers,
  ]);

  // Attach multiplier objects from multiplier_id once the multiplier list loads.
  useEffect(() => {
    if (!selectedRecord?.id || !allMultipliers.length) return;

    setRecordDetails((prev) => {
      if (!prev?.productionItems?.length) return prev;

      let changed = false;
      const productionItems = prev.productionItems.map((item) => ({
        ...item,
        finishedGoods: (item.finishedGoods || []).map((fg) => {
          const multiplierId =
            fg.multiplier?.id ?? fg.multiplier_id ?? fg.multiplierId;
          const resolvedMultiplier = resolveMultiplierFromFgRow(
            fg,
            allMultipliers,
          );

          if (!resolvedMultiplier && !multiplierId) return fg;

          const nextMultiplier = resolvedMultiplier || fg.multiplier || null;
          const nextMultiplierValue =
            nextMultiplier?.multiplier_value != null
              ? parseFloat(nextMultiplier.multiplier_value) || 1.0
              : fg.multiplierValue;

          const multiplierUnchanged =
            (fg.multiplier?.id ?? null) === (nextMultiplier?.id ?? null) &&
            fg.multiplierValue === nextMultiplierValue;

          if (multiplierUnchanged) return fg;

          changed = true;
          return {
            ...fg,
            multiplier: nextMultiplier,
            multiplier_id: multiplierId ?? fg.multiplier_id ?? null,
            multiplierValue: nextMultiplierValue ?? fg.multiplierValue ?? 1.0,
          };
        }),
      }));

      return changed ? { ...prev, productionItems } : prev;
    });
  }, [allMultipliers, selectedRecord?.id]);

  // Recalculate percentage amounts when WIP cost changes (ingredients change)
  useEffect(() => {
    if (!recordDetails || !isCostingDetailPage) return;

    const totals = calculateTotals();
    const wipCost = totals.rawMaterialCost || 0;

    // Recalculate amounts for percentage type lines and rate type lines from templates
    // For "all_items" percentage basis, we need to calculate iteratively
    setOtherCostLines((prevLines) => {
      let hasChanges = false;
      let runningTotal = wipCost;

      const updatedLines = prevLines.map((line) => {
        const isByProductCredit = line.type === "by_product_credit";

        if (line.other_type === "percentage" && line.quantity) {
          const percentage =
            parseFloat(String(line.quantity).replace(/,/g, "")) || 0;
          const percentageBasis = line.percentage_basis || "all_items";
          let calculatedAmount = 0;

          if (percentageBasis === "raw_material") {
            calculatedAmount = (wipCost * percentage) / 100;
          } else if (percentageBasis === "all_items") {
            // Calculate percentage of all items above (raw material + previous other costs)
            calculatedAmount = (runningTotal * percentage) / 100;
          }

          // Update running total for next "all_items" calculation
          // For by_product_credit, subtract; otherwise add
          if (isByProductCredit) {
            runningTotal -= calculatedAmount;
          } else {
            runningTotal += calculatedAmount;
          }

          // Always update percentage amounts to ensure they're correct
          if (Math.abs((line.amount || 0) - calculatedAmount) > 0.01) {
            hasChanges = true;
            return {
              ...line,
              amount: calculatedAmount,
            };
          }
        } else if (
          line.isFromTemplate &&
          line.other_type === "rate" &&
          line.rate &&
          (!line.amount || line.amount === 0)
        ) {
          // Ensure rate type template items have their amount set from rate
          const rateAmount = parseFloat(line.rate || 0);
          // Update running total for rate types too
          if (isByProductCredit) {
            runningTotal -= rateAmount;
          } else {
            runningTotal += rateAmount;
          }
          hasChanges = true;
          return {
            ...line,
            amount: rateAmount,
          };
        } else if (line.other_type === "rate" && line.amount) {
          // Update running total for rate types
          if (isByProductCredit) {
            runningTotal -= line.amount || 0;
          } else {
            runningTotal += line.amount || 0;
          }
        }
        return line;
      });
      return hasChanges ? updatedLines : prevLines;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordDetails?.productionItems,
    isCostingDetailPage,
    // Note: otherCostLines is intentionally excluded to avoid infinite loops
  ]);

  const handlePriceSave = (itemId) => {
    const editData = editingPrices[itemId];
    if (!editData || editData.sellingPrice === undefined) {
      toast.error("Please enter a valid selling price");
      return;
    }

    const item = priceEditItems.find((i) => i.id === itemId);
    if (!item) {
      toast.error("Item not found");
      return;
    }

    // Validate selling price is greater than 0
    const sellingPrice = parseFloat(editData.sellingPrice) || 0;
    if (sellingPrice <= 0) {
      toast.error("Selling price must be greater than 0");
      return;
    }

    // Prepare data for the new PUT endpoint
    const priceData = {
      product_id: item.product_id || item.sku,
      multiplier_id: item.multiplier_id || null,
      expiry_date: item.expiry_date || null,
      selling_price: sellingPrice,
      facilityId: activeBusiness?.id,
    };

    _putApi(
      "/inventory/markup-selling-price",
      priceData,
      (response) => {
        console.log("Price save response:", response);
        if (response.success) {
          toast.success("Selling price updated successfully");
          // Clear all edit modes and editing prices to ensure only one item can be edited at a time
          setPriceEditMode({});
          setEditingPrices({});
          // Refresh the data
          console.log("Calling getPriceEditData to refresh...");
          getPriceEditData();
        } else {
          toast.error(response.message || "Failed to update price");
        }
      },
      (err) => {
        toast.error("Error updating price");
        console.error(err);
      },
    );
  };

  const handlePriceCancel = (itemId) => {
    const itemIdStr = String(itemId);
    setPriceEditMode((prev) => {
      const newMode = { ...prev };
      delete newMode[itemId];
      delete newMode[itemIdStr];
      return newMode;
    });
    setEditingPrices((prev) => {
      const newPrices = { ...prev };
      delete newPrices[itemId];
      delete newPrices[itemIdStr];
      return newPrices;
    });
  };

  // Function to calculate selling price based on cost and markup
  const calculateSellingPrice = (
    costPrice,
    markUp,
    markupMode,
    itemTaxable,
    vatRate = 7.5,
  ) => {
    if (!markUp || markUp === 0) return costPrice || 0;

    let sellingPrice = costPrice || 0;
    if (markupMode === "percentage") {
      sellingPrice = (costPrice || 0) * (1 + markUp / 100);
    } else {
      sellingPrice = (costPrice || 0) + (markUp || 0);
    }

    if (shouldApplyVatOnMarkupPrice(itemTaxable)) {
      const normalizedVatRate = parseFloat(vatRate) || 0;
      if (normalizedVatRate > 0) {
        const vatAmount = sellingPrice * (normalizedVatRate / 100);
        sellingPrice += vatAmount;
      }
    }

    return sellingPrice;
  };

  const getSelectedBatchNo = () =>
    selectedRecord?.batch_id ||
    selectedRecord?.batch_no ||
    selectedRecord?.id ||
    "";

  const isMaterialType = (type) =>
    type === "raw_material" || type === "semi_finished";

  const getNormalizedIngredientType = (ingredient) => {
    const currentType = ingredient?.type || "raw_material";
    const itemType = String(ingredient?.product?.item_type || "").toLowerCase();
    if (itemType === "semi finished") return "semi_finished";
    return currentType;
  };

  /**
   * Output qty for ingredient scaling — matches RecordProductionManufacturing:
   * normal waste → good qty only; abnormal/recyclable → good + waste.
   */
  const normalizeRecordProductionWasteType = (fg) => {
    const t = String(fg?.wasteType ?? fg?.waste_type ?? "")
      .trim()
      .toLowerCase();
    if (t === "abnorm" || t === "abnormal") return "abnormal";
    if (t === "recycled" || t === "recycle" || t === "recyclable") {
      return "recyclable";
    }
    return "normal";
  };

  const getRecordProductionStyleIngredientOutputQty = (fg) => {
    const good = parseFloat(fg?.goodQuantity ?? fg?.quantity ?? 0) || 0;
    const waste = parseFloat(fg?.wasteQuantity ?? 0) || 0;
    const wasteType = normalizeRecordProductionWasteType(fg);
    if (wasteType === "abnormal" || wasteType === "recyclable") {
      return good + waste;
    }
    return good;
  };

  const getRecordProductionStyleTotalOutputQty = (finishedGoodsList) =>
    (finishedGoodsList || []).reduce(
      (sum, fg) => sum + getRecordProductionStyleIngredientOutputQty(fg),
      0,
    );

  const getRecordProductionStyleIngredientExpectedQty = (
    finishedGoodsList,
    ingredient,
  ) => {
    if (!ingredient) return null;
    const t = getNormalizedIngredientType(ingredient);
    if (!isMaterialType(t)) return null;
    const rawMaterialQty = parseFloat(ingredient.quantity || 0);
    if (!rawMaterialQty) return null;
    const totalOut = getRecordProductionStyleTotalOutputQty(finishedGoodsList);
    if (!totalOut) return null;
    return Number((totalOut * rawMaterialQty).toFixed(6));
  };

  /** Rescale material expected qty when output changes; preserve user-entered actual qty. */
  const syncIngredientsToOutputQty = (ingredients, finishedGoods) =>
    (ingredients || []).map((ing) => {
      if (!isMaterialType(getNormalizedIngredientType(ing))) return ing;
      const recipeQty = parseFloat(ing.quantity || 0);
      if (!recipeQty) return ing;
      const expected = getRecordProductionStyleIngredientExpectedQty(
        finishedGoods,
        ing,
      );
      if (expected == null) return ing;
      const expectedStr = String(expected);
      return {
        ...ing,
        expectedQuantity: expectedStr,
        expected_qty: expectedStr,
        expectedQty: expectedStr,
      };
    });

  const getStoredMaterialActualQtyRaw = (ingredient) => {
    const manual =
      ingredient?.actualQuantity ??
      ingredient?.actual_qty ??
      ingredient?.actualQty;

    if (ingredient?.isActualQtyManuallySet) {
      return manual ?? "";
    }

    if (
      manual !== undefined &&
      manual !== null &&
      String(manual).trim() !== ""
    ) {
      return manual;
    }

    return ingredient?.qtyUsed ?? ingredient?.qty_used ?? manual;
  };

  const parseOptionalPostingQty = (v) => {
    if (v === "" || v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  /** Batch qty for ₦ balance: actual (journal-style string ok) or expected fallback — same as posting. */
  const resolveMaterialActualQtyForBalance = (productionItem, ingredient) => {
    const derivedExpected = getRecordProductionStyleIngredientExpectedQty(
      productionItem.finishedGoods || [],
      ingredient,
    );
    let expectedQty = parseOptionalPostingQty(
      ingredient.expectedQuantity ??
        ingredient.expected_qty ??
        ingredient.expectedQty,
    );
    if (expectedQty == null && derivedExpected != null) {
      expectedQty = derivedExpected;
    }
    let actualQty = parseOptionalPostingQty(
      getStoredMaterialActualQtyRaw(ingredient),
    );
    if (actualQty == null) {
      if (ingredient?.isActualQtyManuallySet) {
        actualQty = 0;
      } else if (expectedQty != null) {
        actualQty = expectedQty;
      }
    }
    return actualQty ?? 0;
  };

  const resolveMaterialUnitCost = (ingredient) =>
    resolveMaterialUnitCostFromValuation(ingredient);

  const getFinishedGoodMultiplierValue = (fg) => {
    if (!fg) return 1.0;
    if (
      fg.multiplierValue != null &&
      String(fg.multiplierValue).trim() !== ""
    ) {
      return parseFloat(fg.multiplierValue) || 1.0;
    }
    if (fg.multiplier?.multiplier_value) {
      return parseFloat(fg.multiplier.multiplier_value) || 1.0;
    }
    return 1.0;
  };

  /** Output units × multiplier for one finished-good row (shared costs allocation). */
  const getFinishedGoodQtyTimesMultiplier = (fg) => {
    if (!fg?.finishedGood) return 0;
    return getFinishedGoodOutputUnits(fg) * getFinishedGoodMultiplierValue(fg);
  };

  /** First finished-good row with qty × multiplier for Output tooltip example. */
  const getSharedCostOutputExample = () => {
    for (const productionItem of recordDetails?.productionItems || []) {
      for (const finishedGood of productionItem.finishedGoods || []) {
        const qty = getFinishedGoodOutputUnits(finishedGood);
        const multiplier = getFinishedGoodMultiplierValue(finishedGood);
        if (qty > 0 && multiplier > 0) {
          return {
            qty,
            multiplier,
            output: parseFloat((qty * multiplier).toFixed(2)),
          };
        }
      }
    }
    return { qty: 19.5, multiplier: 10, output: 195 };
  };

  /**
   * Yield % = Total output units ÷ Actual raw material × 100.
   * Total output = Σ (Good QTY × Multiplier / Value), e.g. 1×25 + 4×10 = 65.
   */
  const getSharedCostYieldPercent = () => {
    const outputQty =
      parseFloat(sharedCostOutputPercentage) || calculateTotalMultiplier() || 0;
    const rawMaterialQty = sumSharedActualRawMaterialsInputQty(sharedCosts, 1);
    if (!outputQty || !rawMaterialQty) return null;

    return parseFloat(((outputQty / rawMaterialQty) * 100).toFixed(2));
  };

  /** Expected yield from costing template Output Percentage field. */
  const parseTemplateExpectedYieldFromData = (data) => {
    if (!data) return null;
    if (data.expectedYield != null && String(data.expectedYield).trim() !== "") {
      const explicit = parseFloat(data.expectedYield);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
    }
    if (
      data.outputPercentage != null &&
      String(data.outputPercentage).trim() !== ""
    ) {
      const fromPct = parseFloat(data.outputPercentage);
      if (Number.isFinite(fromPct) && fromPct > 0) return fromPct;
    }
    const outputVal = parseFloat(data.output);
    if (Number.isFinite(outputVal) && outputVal > 0 && outputVal <= 100) {
      return outputVal;
    }
    return null;
  };

  const parseTemplateExpectedYieldFromNotes = (notes) => {
    if (!notes) return null;
    if (typeof notes === "object") {
      return parseTemplateExpectedYieldFromData(notes);
    }
    try {
      const jsonMatch = notes.match(/--- JSON DATA ---\n([\s\S]*)$/);
      if (jsonMatch) {
        return parseTemplateExpectedYieldFromData(JSON.parse(jsonMatch[1]));
      }
    } catch {
      /* fall through */
    }
    const textMatch = notes.match(/Output Percentage:\s*([\d.]+)%?/i);
    if (textMatch) {
      const n = parseFloat(textMatch[1]);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  };

  const getSharedCostExpectedYieldPercent = () => {
    if (
      sharedCostExpectedYieldPercent != null &&
      sharedCostExpectedYieldPercent > 0
    ) {
      return sharedCostExpectedYieldPercent;
    }
    return null;
  };

  const getSharedCostYieldVarianceMeta = () => {
    const actual = getSharedCostYieldPercent();
    const expected = getSharedCostExpectedYieldPercent();
    if (actual == null || expected == null || expected <= 0) return null;

    const variancePp = parseFloat((actual - expected).toFixed(2));
    const varianceRel = Math.abs((variancePp / expected) * 100);

    return {
      actual,
      expected,
      variancePp,
      varianceRel: Number(varianceRel.toFixed(2)),
      // Shared yield variance is informational only — no reason/review gate.
      action: "ok",
    };
  };

  /** ₦ amount = TOTAL SHARED COSTS PER UNIT ÷ Yield (%). */
  const getSharedCostOutputAmount = useCallback(() => {
    const perUnit = sharedCostSummaryAmounts.totalSharedCostsPerUnit;
    if (!perUnit) return 0;

    const outputQty =
      parseFloat(sharedCostOutputPercentage) ||
      computeTotalMultiplierFromItems(recordDetails?.productionItems) ||
      0;
    const rawMaterialQty = sumSharedActualRawMaterialsInputQty(sharedCosts, 1);

    if (!outputQty || !rawMaterialQty) return 0;

    const yieldPct = parseFloat(
      ((outputQty / rawMaterialQty) * 100).toFixed(4),
    );
    if (!yieldPct) return 0;

    return perUnit / yieldPct;
  }, [
    sharedCosts,
    recordDetails?.productionItems,
    sharedCostOutputPercentage,
    sharedCostSummaryAmounts.totalSharedCostsPerUnit,
  ]);

  useEffect(() => {
    if (sharedCostExpectedYieldPercent != null) return;
    const isJoint =
      selectedRecord?.costing_type === "joint_shared" ||
      selectedRecord?.type === "joint_shared" ||
      selectedRecord?.costingType === "joint_shared";
    if (!isJoint || !productGroups.length) return;

    for (const group of productGroups) {
      const notesText =
        typeof group.notes === "string"
          ? group.notes
          : group.notes
            ? JSON.stringify(group.notes)
            : "";
      if (!notesText.includes("Shared Costing Template")) continue;

      const expectedYield =
        group.output_percentage != null &&
        String(group.output_percentage).trim() !== ""
          ? parseFloat(group.output_percentage)
          : parseTemplateExpectedYieldFromNotes(group.notes ?? notesText);

      if (expectedYield == null || !Number.isFinite(expectedYield)) continue;
      setSharedCostExpectedYieldPercent(expectedYield);
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    productGroups,
    selectedRecord?.id,
    sharedCostExpectedYieldPercent,
    sharedCosts.length,
  ]);

  /** Sum of (output units × multiplier) across all finished goods on this production item. */
  const getProductionItemTotalMultiplierUsed = (productionItem) =>
    (productionItem?.finishedGoods || []).reduce(
      (sum, fg) => sum + getFinishedGoodQtyTimesMultiplier(fg),
      0,
    );

  const getJointSharedMultiplierOutput = (productionItem) => {
    const costingType =
      selectedRecord?.costing_type ||
      selectedRecord?.type ||
      selectedRecord?.costingType;
    if (costingType !== "joint_shared" || sharedCosts.length === 0) {
      return 0;
    }
    const outputValue = parseFloat(sharedCostOutputPercentage) || 1;
    const outputAmount = getSharedCostOutputAmount();
    const totalUsed = getProductionItemTotalMultiplierUsed(productionItem);
    if (!(totalUsed > 0)) return 0;
    return Number((outputAmount * totalUsed).toFixed(2));
  };

  const getMultiplierBreakdownDisplay = (productionItem) => {
    const amount = getJointSharedMultiplierOutput(productionItem);
    if (!(amount > 0)) return null;
    const finishedGoodsForItem = productionItem?.finishedGoods || [];
    const primaryFinishedGood =
      finishedGoodsForItem.find((fg) => fg.finishedGood) ||
      finishedGoodsForItem[0];
    const goodQty = primaryFinishedGood
      ? getCostingGoodQuantity(primaryFinishedGood)
      : 0;
    const outputUnits = primaryFinishedGood
      ? getFinishedGoodOutputUnits(primaryFinishedGood)
      : getProductionOutputUnits(productionItem);
    const multiplierValue = getFinishedGoodMultiplierValue(primaryFinishedGood);
    const totalUsed = getProductionItemTotalMultiplierUsed(productionItem);
    const outputValue = parseFloat(sharedCostOutputPercentage) || 1;
    const outputAmount = getSharedCostOutputAmount();
    const stackBeforeShared =
      getMaterialsAndAdjustmentsStackTotal(productionItem);
    const qtyForShared =
      outputUnits > 0 ? outputUnits : getProductionOutputUnits(productionItem);
    const perUnitShared =
      qtyForShared > 0
        ? Number((amount / qtyForShared).toFixed(2))
        : Number((outputAmount * multiplierValue).toFixed(2));
    const batchSharedAmount = Number(
      (perUnitShared * (qtyForShared || 1)).toFixed(2),
    );
    return {
      amount,
      perUnitShared,
      batchSharedAmount,
      goodQty,
      outputUnits: qtyForShared,
      multiplierValue,
      totalUsed,
      outputAmount,
      stackBeforeShared,
      cumulativeAfterShared: Number((stackBeforeShared + amount).toFixed(2)),
    };
  };

  /** Line amount for one material row (Actual Qty × Rate ÷ Basis) — matches green amount in UI. */
  const getMaterialLineAmount = (productionItem, ingredient) => {
    const cost = resolveMaterialUnitCost(ingredient);
    const qty = resolveMaterialActualQtyForBalance(productionItem, ingredient);
    const lineBasis =
      parseOptionalPostingQty(
        ingredient.basis ??
          ingredient.rate_basis ??
          ingredient.rateBasis ??
          ingredient.line_basis,
      ) ?? 1;
    return Number(((qty * cost) / lineBasis).toFixed(2));
  };

  const sumMaterialLineAmounts = (productionItem) =>
    Number(
      (productionItem?.ingredients || [])
        .filter((ing) => isMaterialType(getNormalizedIngredientType(ing)))
        .reduce(
          (sum, ing) => sum + getMaterialLineAmount(productionItem, ing),
          0,
        )
        .toFixed(2),
    );

  const getRawMaterialsSubtotalAmount = (productionItem) =>
    Number(
      (
        sumMaterialLineAmounts(productionItem) +
        getJointSharedMultiplierOutput(productionItem)
      ).toFixed(2),
    );

  /** Raw materials + other costs − by-product credits (before shared multiplier). */
  const getMaterialsAndAdjustmentsStackTotal = (productionItem) => {
    const rawMaterialsBatchTotal = sumMaterialLineAmounts(productionItem);
    const multiplierAmount = getJointSharedMultiplierOutput(productionItem);
    let runningBatch = rawMaterialsBatchTotal + multiplierAmount;
    let stack = rawMaterialsBatchTotal;

    for (const ing of (productionItem?.ingredients || []).filter(
      (i) => i.type === "by_product_credit",
    )) {
      const lineAmount = getNonRawCostLineBatchAmount(
        productionItem,
        ing,
        rawMaterialsBatchTotal,
        runningBatch,
      );
      stack = Number((stack - lineAmount).toFixed(2));
      runningBatch = Number((runningBatch - lineAmount).toFixed(2));
    }
    for (const ing of (productionItem?.ingredients || []).filter(
      (i) => i.type === "other",
    )) {
      const lineAmount = getNonRawCostLineBatchAmount(
        productionItem,
        ing,
        rawMaterialsBatchTotal,
        runningBatch,
      );
      stack = Number((stack + lineAmount).toFixed(2));
      runningBatch = Number((runningBatch + lineAmount).toFixed(2));
    }
    return stack;
  };

  const getProductionPerUnitFromBatchAmount = (productionItem, batchAmount) => {
    const outputUnits = getProductionOutputUnits(productionItem);
    if (!outputUnits) {
      return Number(Number(batchAmount).toFixed(2));
    }
    return Number((Number(batchAmount) / outputUnits).toFixed(2));
  };

  const getNonRawCostLineBatchAmount = (
    productionItem,
    ing,
    rawMaterialsBatchTotal,
    runningBatchTotal,
  ) => {
    const inputType = ing.other_type || "rate";
    if (inputType === "rate") {
      const perUnit = parseFloat(ing.rate || 0) || 0;
      if (perUnit > 0) {
        return getOtherRateLineAmount(productionItem, perUnit);
      }
    }
    if (
      inputType !== "rate" &&
      ing.amount !== undefined &&
      ing.amount !== null &&
      String(ing.amount).trim() !== ""
    ) {
      return parseFloat(ing.amount || 0) || 0;
    }
    if (inputType === "rate") {
      return 0;
    }
    if (inputType === "percentage") {
      const pct = parseFloat(ing.quantity || 0) || 0;
      const basis = ing.percentage_basis || "all_items";
      if (basis === "raw_material") {
        return (pct / 100) * rawMaterialsBatchTotal;
      }
      if (basis === "all_items") {
        return (pct / 100) * runningBatchTotal;
      }
    }
    return 0;
  };

  /** Per-unit balance + cumulative running batch total for each Cost Breakdown row. */
  const buildProductionCostBreakdownBalances = (productionItem) => {
    const balances = new Map();
    let running = 0;
    let runningBatch = 0;

    const rawMaterialsBatchTotal = sumMaterialLineAmounts(productionItem);
    const multiplierAmount = getJointSharedMultiplierOutput(productionItem);
    const subtotalAmount = rawMaterialsBatchTotal + multiplierAmount;

    const materials = (productionItem?.ingredients || []).filter((ing) =>
      isMaterialType(getNormalizedIngredientType(ing)),
    );

    for (const ing of materials) {
      const lineAmount = getMaterialLineAmount(productionItem, ing);
      running = Number((running + lineAmount).toFixed(2));
      balances.set(`rm-${ing.id}`, {
        perUnit: getProductionPerUnitFromBatchAmount(
          productionItem,
          lineAmount,
        ),
        runningBalance: running,
      });
    }

    if (materials.length > 0) {
      running = rawMaterialsBatchTotal;
      runningBatch = rawMaterialsBatchTotal;
      balances.set("subtotal-rm-materials", {
        perUnit: getProductionPerUnitFromBatchAmount(
          productionItem,
          rawMaterialsBatchTotal,
        ),
        runningBalance: running,
      });
    }

    if (multiplierAmount > 0) {
      running = Number((running + multiplierAmount).toFixed(2));
      runningBatch = running;
      balances.set("multiplier-shared", {
        perUnit: getProductionPerUnitFromBatchAmount(
          productionItem,
          multiplierAmount,
        ),
        runningBalance: running,
      });
    }

    if (materials.length > 0 || multiplierAmount > 0) {
      running = subtotalAmount;
      runningBatch = subtotalAmount;
      balances.set("subtotal-rm", {
        perUnit: getProductionPerUnitFromBatchAmount(
          productionItem,
          subtotalAmount,
        ),
        runningBalance: running,
      });
    } else {
      runningBatch = subtotalAmount;
    }

    const byProducts = (productionItem?.ingredients || []).filter(
      (ing) => ing.type === "by_product_credit",
    );
    let runningMaterialsStack = rawMaterialsBatchTotal;
    for (const ing of byProducts) {
      const lineAmount = getNonRawCostLineBatchAmount(
        productionItem,
        ing,
        rawMaterialsBatchTotal,
        runningBatch,
      );
      runningBatch = Number((runningBatch - lineAmount).toFixed(2));
      running = Number((running - lineAmount).toFixed(2));
      const priorBalance = runningMaterialsStack;
      runningMaterialsStack = Number(
        (runningMaterialsStack - lineAmount).toFixed(2),
      );
      const inputType = ing.other_type || "rate";
      const perUnit =
        inputType === "rate"
          ? parseJournalStyleAmount(ing.rate) || 0
          : getProductionPerUnitFromBatchAmount(productionItem, lineAmount);
      balances.set(`bp-${ing.id}`, {
        perUnit,
        lineAmount,
        priorBalance,
        runningBalance: runningMaterialsStack,
        isCredit: true,
      });
    }

    const others = (productionItem?.ingredients || []).filter(
      (ing) => ing.type === "other",
    );
    for (const ing of others) {
      const lineAmount = getNonRawCostLineBatchAmount(
        productionItem,
        ing,
        rawMaterialsBatchTotal,
        runningBatch,
      );
      runningBatch = Number((runningBatch + lineAmount).toFixed(2));
      running = Number((running + lineAmount).toFixed(2));
      const priorBalance = runningMaterialsStack;
      runningMaterialsStack = Number(
        (runningMaterialsStack + lineAmount).toFixed(2),
      );
      const inputType = ing.other_type || "rate";
      const perUnit =
        inputType === "rate"
          ? parseJournalStyleAmount(ing.rate) || 0
          : getProductionPerUnitFromBatchAmount(productionItem, lineAmount);
      balances.set(`oth-${ing.id}`, {
        perUnit,
        lineAmount,
        priorBalance,
        runningBalance: runningMaterialsStack,
      });
    }

    return balances;
  };

  const renderProductionBalanceCell = (
    meta,
    primaryClassName = "text-orange-700",
    { rateAndLineAmount = false } = {},
  ) => {
    if (!meta) {
      return <td className="px-2 py-2 text-sm text-right text-gray-400">—</td>;
    }
    let displayAmount;
    let sublineValue;
    if (rateAndLineAmount && meta.lineAmount != null) {
      // Other / by-product rate lines: rate on top, cumulative running batch below.
      displayAmount = meta.perUnit;
      sublineValue = meta.runningBalance;
    } else {
      // Raw materials: per-unit on top, cumulative running batch below.
      displayAmount = meta.perUnit;
      sublineValue = meta.runningBalance;
    }
    return (
      <td className={`px-2 py-2 text-sm text-right ${primaryClassName}`}>
        <div className="font-semibold tabular-nums">
          {formatNumber(Number(displayAmount).toFixed(2))}
        </div>
        <div className="text-xs text-gray-500 border-t border-gray-200 pt-1 mt-1 tabular-nums">
          {formatNumber(Number(sublineValue).toFixed(2))}
        </div>
      </td>
    );
  };

  /**
   * Batch production cost from Actual Qty × rate (materials) + scaled other/fixed lines.
   * Matches Cost Breakdown Balance column and GL posting totals.
   */
  const computeProductionBatchCostFromActuals = (productionItem) => {
    const ingredients = productionItem?.ingredients || [];

    const rawMaterialsBatchTotal = ingredients
      .filter((ing) => isMaterialType(getNormalizedIngredientType(ing)))
      .reduce((sum, ing) => {
        const cost = resolveMaterialUnitCost(ing);
        const qty = resolveMaterialActualQtyForBalance(productionItem, ing);
        const lineBasis =
          parseOptionalPostingQty(
            ing.basis ?? ing.rate_basis ?? ing.rateBasis ?? ing.line_basis,
          ) ?? 1;
        return sum + Number(((qty * cost) / lineBasis).toFixed(2));
      }, 0);

    const multiplierOutput = getJointSharedMultiplierOutput(productionItem);
    let runningBatch = rawMaterialsBatchTotal + multiplierOutput;

    const nonRawLines = ingredients.filter(
      (ing) => ing.type === "by_product_credit" || ing.type === "other",
    );

    const getLineBatchAmount = (ing, runningBatchTotal) => {
      const inputType = ing.other_type || "rate";
      if (inputType === "rate") {
        const perUnit =
          parseFloat(ing.rate || 0) || parseFloat(ing.amount || 0) || 0;
        return getOtherRateLineAmount(productionItem, perUnit);
      }
      if (inputType === "percentage") {
        const pct = parseFloat(ing.quantity || 0) || 0;
        const basis = ing.percentage_basis || "all_items";
        if (basis === "raw_material") {
          return (pct / 100) * rawMaterialsBatchTotal;
        }
        if (basis === "all_items") {
          return (pct / 100) * runningBatchTotal;
        }
      }
      return 0;
    };

    let totalBatchCost = runningBatch;
    for (const ing of nonRawLines) {
      const lineBatch = getLineBatchAmount(ing, runningBatch);
      if (ing.type === "by_product_credit") {
        runningBatch -= lineBatch;
        totalBatchCost -= lineBatch;
      } else {
        runningBatch += lineBatch;
        totalBatchCost += lineBatch;
      }
    }

    return Number(totalBatchCost.toFixed(2));
  };

  /** Material qty for posting — respects waste type (good + waste for abnormal/recyclable). */
  const resolveMaterialQtyForPostingCost = (productionItem, ingredient) => {
    const derived = getRecordProductionStyleIngredientExpectedQty(
      productionItem.finishedGoods || [],
      ingredient,
    );
    if (derived != null) return derived;
    return resolveMaterialActualQtyForBalance(productionItem, ingredient);
  };

  /** Abnormal/recyclable waste qty (split across FG + waste at same unit rate). */
  const getAbnormalRecyclableWasteQty = (productionItem, fgRow = null) => {
    const rows = fgRow
      ? [fgRow]
      : (productionItem?.finishedGoods || []).filter((fg) => fg?.finishedGood);

    let splitWasteQty = 0;
    for (const fg of rows) {
      const wasteQty =
        parseFloat(fg.wasteQuantity ?? fg.waste_quantity ?? 0) || 0;
      const wasteType = String(fg.wasteType ?? fg.waste_type ?? "normal")
        .trim()
        .toLowerCase();
      const splitsOutput =
        wasteQty > 0 &&
        (wasteType === "abnormal" ||
          wasteType === "abnorm" ||
          wasteType === "recyclable" ||
          wasteType === "recycled" ||
          wasteType === "recycle");
      if (splitsOutput) {
        splitWasteQty += wasteQty;
      }
    }
    return splitWasteQty;
  };

  /** Good + abnormal/recyclable waste (output units); else good only. */
  const getProductionOutputUnits = (productionItem, fgRow = null) => {
    if (fgRow) {
      return getFinishedGoodOutputUnits(fgRow);
    }
    const goodQty = getTotalGoodQuantityForItem(productionItem);
    const splitWasteQty = getAbnormalRecyclableWasteQty(productionItem, fgRow);
    if (splitWasteQty > 0) {
      return goodQty + splitWasteQty;
    }
    return goodQty || 0;
  };

  /** Qty multiplier for fixed other/by-product rate lines (per-unit rate × output units). */
  const getOtherRateQtyScale = (productionItem) => {
    const units = getProductionOutputUnits(productionItem);
    return units > 0 ? units : 1;
  };

  const getOtherRateLineAmount = (productionItem, rate) => {
    const perUnit = parseFloat(rate || 0) || 0;
    if (!perUnit) return 0;
    return Number((perUnit * getOtherRateQtyScale(productionItem)).toFixed(2));
  };

  /** Good + waste qty when waste is abnormal/recyclable (journal split); else good only. */
  const getProductionCostDenominator = (productionItem, fgRow = null) =>
    getProductionOutputUnits(productionItem, fgRow);

  /**
   * Sum of every line amount in Cost Breakdown (materials + shared multiplier
   * + other costs − by-product credits).
   */
  const sumProductionCostLineAmounts = (productionItem) =>
    computeProductionBatchCostFromActuals(productionItem);

  /**
   * Batch total = sum of all line amounts.
   * Per unit = batch ÷ output qty (good, or good + abnormal/recyclable waste).
   */
  const computeProductionCostTotals = (productionItem) => {
    const goodQty = getTotalGoodQuantityForItem(productionItem);
    const splitWasteQty = getAbnormalRecyclableWasteQty(productionItem);
    const totalBatchCost = sumProductionCostLineAmounts(productionItem);
    const outputUnits = getProductionOutputUnits(productionItem);
    const costPerUnit =
      outputUnits > 0
        ? Number((totalBatchCost / outputUnits).toFixed(2))
        : totalBatchCost;
    return {
      costPerUnit,
      totalBatchCost,
      goodQty,
      splitWasteQty,
      outputUnits,
    };
  };

  const computeProductionCostPerUnit = (productionItem) =>
    computeProductionCostTotals(productionItem).costPerUnit;

  const jointSharedJournalPreview = useMemo(() => {
    if (!isSelectedRecordJointShared) return null;
    const wipCode = activeBusiness?.wip || "WIP";
    const selectedBp = templateByProduct.selectedTemplateByProduct;
    const templatePayload = selectedBp
      ? {
          productSku: selectedBp.sku || selectedBp.item_code || "",
          productName: selectedBp.item_name || selectedBp.name || "",
          items: templateByProduct.templateByProductItems,
          units: templateByProduct.templateByProductQty,
          unit_cost: templateByProduct.templateByProductUnitCost,
          selectedProduct: selectedBp,
          inventory_account: selectedBp.inventory_account || "",
        }
      : null;

    return buildJointSharedJournalPreview({
      wipCode,
      sharedCosts,
      sharedCostQtyUse,
      templateByProduct: templatePayload,
      productionItems: recordDetails?.productionItems || [],
      finishedGoodCatalog: finishedGoodProducts,
      getMaterialLineAmount,
      getOtherRateLineAmount,
      getCostingGoodQuantity,
      computeProductionCostTotals,
    });
  }, [
    isSelectedRecordJointShared,
    activeBusiness?.wip,
    sharedCosts,
    sharedCostQtyUse,
    templateByProduct.selectedTemplateByProduct,
    templateByProduct.templateByProductItems,
    templateByProduct.templateByProductQty,
    templateByProduct.templateByProductUnitCost,
    recordDetails?.productionItems,
    finishedGoodProducts,
  ]);

  const getJournalUnitCostForPosting = (productionItem, fg) => {
    if (fg) {
      const totalBatchCost =
        computeProductionBatchCostFromActuals(productionItem);
      const outputUnits = getProductionOutputUnits(productionItem, fg);
      return outputUnits > 0
        ? Number((totalBatchCost / outputUnits).toFixed(4))
        : totalBatchCost;
    }
    return computeProductionCostPerUnit(productionItem);
  };

  const getFinishedGoodCostPerUnitForMarkup = (
    productionItem,
    finishedGoodRow,
    _options = {},
  ) =>
    finishedGoodRow
      ? getJournalUnitCostForPosting(productionItem, finishedGoodRow)
      : computeProductionCostPerUnit(productionItem);

  const computeIngredientVarianceScan = useCallback(
    (details) => {
      const empty = {
        hasSupervisorReview: false,
        hasReasonRequired: false,
        flaggedLines: [],
      };
      if (!details?.productionItems?.length) return empty;
      const flaggedLines = [];
      let hasSupervisorReview = false;
      let hasReasonRequired = false;
      for (const pi of details.productionItems) {
        for (const ing of pi.ingredients || []) {
          if (!isMaterialType(getNormalizedIngredientType(ing))) continue;
          if (!ing.product) continue;
          const derivedExpected = getRecordProductionStyleIngredientExpectedQty(
            pi.finishedGoods || [],
            ing,
          );
          let expected = parseOptionalPostingQty(
            ing.expectedQuantity ?? ing.expected_qty ?? ing.expectedQty,
          );
          if (expected == null && derivedExpected != null) {
            expected = derivedExpected;
          }
          let actual = parseOptionalPostingQty(
            getStoredMaterialActualQtyRaw(ing),
          );
          if (actual == null) {
            if (ing?.isActualQtyManuallySet) {
              actual = 0;
            } else if (expected != null) {
              actual = expected;
            }
          }
          if (expected == null || Math.abs(Number(expected)) < 1e-9) {
            continue;
          }
          const a = Number(actual);
          const e = Number(expected);
          if (!Number.isFinite(a) || !Number.isFinite(e)) continue;
          const pct = Math.abs((a - e) / e) * 100;
          if (!Number.isFinite(pct)) continue;
          const action =
            pct <= 2 ? "ok" : pct <= 5 ? "review" : "reason_required";
          if (action === "review") hasSupervisorReview = true;
          if (action === "reason_required") hasReasonRequired = true;
          if (action !== "ok") {
            flaggedLines.push({
              productionItemId: pi.id,
              ingredientId: ing.id,
              sku:
                ing.rawMaterialSku ||
                ing.product?.sku ||
                ing.product?.item_code ||
                "",
              name: ing.product?.item_name || ing.product?.name || "",
              variancePercent: Number(pct.toFixed(2)),
              action,
            });
          }
        }
      }
      return { hasSupervisorReview, hasReasonRequired, flaggedLines };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable pure helpers from closure
    [],
  );

  const ingredientVarianceScan = useMemo(
    () => computeIngredientVarianceScan(recordDetails),
    [recordDetails, computeIngredientVarianceScan],
  );

  const ingredientVarianceReasonLength =
    ingredientVarianceWrittenReason.trim().length;
  const ingredientVarianceReasonComplete =
    ingredientVarianceReasonLength >= 15;

  const renderIngredientVarianceReasonPanel = () => {
    if (!ingredientVarianceScan.hasReasonRequired) return null;
    const flaggedForReason = (
      ingredientVarianceScan.flaggedLines || []
    ).filter((l) => l.action === "reason_required");
    return (
      <div
        id="ingredient-variance-reason"
        ref={ingredientVarianceReasonRef}
        className="mb-6 bg-amber-50 border-2 border-amber-400 rounded-lg shadow-sm overflow-hidden"
      >
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-3">
          <h3 className="text-base font-bold text-amber-950">
            Variance explanation required
          </h3>
          <p className="text-sm text-amber-900 mt-0.5">
            Actual material usage is more than 5% away from expected on one or
            more lines. Enter a written reason here before you can Complete
            Batch.
          </p>
        </div>
        <div className="px-4 py-4 space-y-3">
          {flaggedForReason.length > 0 && (
            <ul className="text-xs text-amber-900 space-y-1 list-disc list-inside">
              {flaggedForReason.map((line) => (
                <li key={`${line.productionItemId}-${line.ingredientId}`}>
                  <span className="font-semibold">
                    {line.name || line.sku || "Material"}
                  </span>
                  {line.sku && line.name ? ` (${line.sku})` : ""}
                  {" — "}
                  {line.variancePercent}% variance vs expected
                </li>
              ))}
            </ul>
          )}
          <div>
            <label
              htmlFor="ingredient-variance-written-reason"
              className="block text-sm font-semibold text-amber-950 mb-1.5"
            >
              Written reason
            </label>
            <Textarea
              id="ingredient-variance-written-reason"
              value={ingredientVarianceWrittenReason}
              onChange={(e) =>
                setIngredientVarianceWrittenReason(e.target.value)
              }
              placeholder="Explain why actual usage differed from expected (e.g. higher moisture in maize required extra input to hit yield target)…"
              rows={4}
              className="w-full text-sm bg-white border-amber-300 focus-visible:ring-amber-400"
            />
            <p
              className={`mt-1.5 text-xs tabular-nums ${
                ingredientVarianceReasonComplete
                  ? "text-green-700 font-medium"
                  : "text-amber-800"
              }`}
            >
              {ingredientVarianceReasonComplete
                ? "Reason saved — you can Complete Batch."
                : `${ingredientVarianceReasonLength}/15 characters minimum`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const getMaterialLineVarianceMeta = (productionItem, ingredient) => {
    if (!isMaterialType(getNormalizedIngredientType(ingredient))) {
      return null;
    }
    if (!ingredient.product) return null;
    const derivedExpected = getRecordProductionStyleIngredientExpectedQty(
      productionItem.finishedGoods || [],
      ingredient,
    );
    let expected = parseOptionalPostingQty(
      ingredient.expectedQuantity ??
        ingredient.expected_qty ??
        ingredient.expectedQty,
    );
    if (expected == null && derivedExpected != null) {
      expected = derivedExpected;
    }
    let actual = parseOptionalPostingQty(
      getStoredMaterialActualQtyRaw(ingredient),
    );
    if (actual == null) {
      if (ingredient?.isActualQtyManuallySet) {
        actual = 0;
      } else if (expected != null) {
        actual = expected;
      }
    }
    if (expected == null || Math.abs(Number(expected)) < 1e-9) {
      return null;
    }
    const a = Number(actual);
    const e = Number(expected);
    if (!Number.isFinite(a) || !Number.isFinite(e)) return null;
    const pct = Math.abs((a - e) / e) * 100;
    if (!Number.isFinite(pct)) return null;
    const action = pct <= 2 ? "ok" : pct <= 5 ? "review" : "reason_required";
    return {
      variancePercent: Number(pct.toFixed(2)),
      action,
      expected,
      actual,
    };
  };

  const fields = [
    {
      title: "Item Details",
      custom: true,
      component: (item) => (
        <div className="">
          <div className="font-medium text-gray-900">{item.item_name}</div>
          <div className="text-sm text-gray-500">
            {moment(item.created_at).format("DD-MM-YYYY")}
          </div>
        </div>
      ),
    },
    {
      title: "Unit of Measure",
      custom: true,
      component: (item) => (
        <div className="">
          <div className="font-medium text-gray-900">{item.category}</div>
          <div className="font-medium text-gray-900">
            {item.unit_of_measure}
          </div>
        </div>
      ),
    },
    {
      title: "Quantity",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">
            {formatNumber1(item.qty_in || 0)}
          </div>
        </div>
      ),
    },
    {
      title: "Unit Cost (₦)",
      custom: true,
      component: (item) => {
        const costPrice = item.valuation_cost || item.cost_price || 0;
        return (
          <div className="text-right">
            <div className="font-medium text-gray-900">
              {formatNumber(costPrice)}
            </div>
            {item.valuation_method && item.valuation_method !== "WAC" && (
              <div className="text-xs text-gray-500">
                {item.valuation_method}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Markup",
      custom: true,
      component: (item) => (
        <div className="text-right">
          {item.mark_up
            ? item.markup_mode === "percentage"
              ? `${item.mark_up}%`
              : `₦${formatNumber(item.mark_up)}`
            : "-"}
        </div>
      ),
    },
    {
      title: "Selling Price (₦)",
      custom: true,
      component: (item) => {
        const costPrice = item.valuation_cost || item.cost_price || 0;
        const sellingPrice =
          item.selling_price ||
          calculateSellingPrice(
            costPrice,
            item.mark_up,
            item.markup_mode,
            item.taxable,
            item.vat_rate,
          );
        return (
          <div className="text-right font-medium text-gray-900">
            {formatNumber1(sellingPrice)}
          </div>
        );
      },
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <Badge
            variant={
              item.status === "Active" && item.activation !== "deactivated"
                ? "success"
                : "outline"
            }
          >
            {item.activation === "deactivated"
              ? "Deactivated"
              : item.status || "Active"}
          </Badge>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (item) => (
        <div className="text-center flex gap-1 justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <UIButton
                variant="ghost"
                className="flex size-8 text-slate-500 data-[state=open]:bg-slate-100 dark:text-slate-400 dark:data-[state=open]:bg-slate-800"
                size="icon"
              >
                <MoreVerticalIcon />
                <span className="sr-only">Open menu</span>
              </UIButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                Set Price
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  // Fields for direct price editing tab
  const priceEditFields = [
    {
      title: "Item Details",
      custom: true,
      component: (item) => (
        <div className="">
          <div className="font-medium text-gray-900">{item.item_name}</div>
          <div className="text-sm text-gray-500">{item.product_id}</div>
        </div>
      ),
    },
    {
      title: "Expiry Date",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">
            {item.expiry_date
              ? moment(item.expiry_date).format("DD-MM-YYYY")
              : "N/A"}
          </div>
        </div>
      ),
    },
    {
      title: "Quantity",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <div className="font-medium text-gray-900">
            {formatNumber1(item.balance || 0)}
          </div>
        </div>
      ),
    },
    // {
    //   title: "Unit Cost (₦)",
    //   custom: true,
    //   component: (item) => {
    //     const isEditing = priceEditMode[item.id];
    //     const costPrice = item.valuation_cost || item.cost_price || 0;

    //     return (
    //       <div className="text-right">
    //         {isEditing ? (
    //           <Input
    //             type="number"
    //             step="0.01"
    //             value={editingPrices[item.id]?.costPrice || costPrice}
    //             onChange={(e) =>
    //               handleFieldChange(item.id, "costPrice", e.target.value)
    //             }
    //             className="w-50 text-right text-xs"
    //             placeholder="0.00"
    //           />
    //         ) : (
    //           <div className="font-medium text-gray-900">
    //             {formatNumber(costPrice)}
    //           </div>
    //         )}
    //       </div>
    //     );
    //   },
    // },
    // {
    //   title: "Markup",
    //   custom: true,
    //   component: (item) => {
    //     const isEditing = priceEditMode[item.id];

    //     return (
    //       <div className="text-end">
    //         {isEditing ? (
    //           <div className="flex flex-col gap-1">
    //             <Input
    //               type="number"
    //               step="0.01"
    //               value={editingPrices[item.id]?.markUp || item.mark_up || 0}
    //               onChange={(e) =>
    //                 handleFieldChange(item.id, "markUp", e.target.value)
    //               }
    //               className="w-50 text-center text-xs"
    //               placeholder="0"
    //             />
    //             <select
    //               value={
    //                 editingPrices[item.id]?.markupMode ||
    //                 item.markup_mode ||
    //                 "percentage"
    //               }
    //               onChange={(e) =>
    //                 handleFieldChange(item.id, "markupMode", e.target.value)
    //               }
    //               className="w-20 text-xs border rounded px-1 py-0.5"
    //             >
    //               <option value="percentage">Percentage</option>
    //               <option value="fixed">Fixed</option>
    //             </select>
    //           </div>
    //         ) : (
    //           <div>
    //             {item.mark_up
    //               ? item.markup_mode === "percentage"
    //                 ? `${item.mark_up}%`
    //                 : `₦${formatNumber(item.mark_up)}`
    //               : "-"}
    //           </div>
    //         )}
    //       </div>
    //     );
    //   },
    // },
    {
      title: "Selling Price (₦)",
      custom: true,
      className: "text-right",
      component: (item) => {
        const itemIdStr = String(item.id);
        const isEditing =
          priceEditMode[item.id] === true || priceEditMode[itemIdStr] === true;
        const costPrice = item.valuation_cost || item.cost_price || 0;
        const currentPrice =
          item.selling_price ||
          calculateSellingPrice(
            costPrice,
            item.mark_up,
            item.markup_mode,
            item.taxable,
            item.vat_rate,
          );

        if (isEditing) {
          const editData = editingPrices[item.id] || editingPrices[itemIdStr];
          const sellingPrice = editData?.sellingPrice ?? currentPrice;

          return (
            <div
              className="flex justify-end"
              key={`price-edit-wrapper-${item.id}`}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice === 0 ? "" : sellingPrice || ""}
                onChange={(e) => {
                  const newValue = e.target.value;
                  handleFieldChange(item.id, "sellingPrice", newValue);
                }}
                className="w-32 text-right text-sm font-semibold"
                placeholder="0.00"
                autoFocus
              />
            </div>
          );
        }

        return (
          <div className="text-right font-medium text-gray-900">
            {formatNumber1(currentPrice)}
          </div>
        );
      },
    },
    {
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => {
        const isEditing = priceEditMode[item.id];

        return (
          <div className="text-center">
            {isEditing ? (
              <div className="flex gap-1 justify-center">
                <UIButton
                  size="sm"
                  onClick={() => handlePriceSave(item.id)}
                  className="h-6 px-2 text-xs"
                >
                  <Check className="h-3 w-3" />
                </UIButton>
                <UIButton
                  size="sm"
                  variant="outline"
                  onClick={() => handlePriceCancel(item.id)}
                  className="h-6 px-2 text-xs"
                >
                  <Ban className="h-3 w-3" />
                </UIButton>
              </div>
            ) : (
              <UIButton
                variant="outline"
                size="sm"
                onClick={() => handlePriceEdit(item.id)}
                className="text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </UIButton>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      custom: true,
      component: (item) => (
        <div className="text-center">
          <Badge
            variant={
              item.status === "Active" && item.activation !== "deactivated"
                ? "success"
                : "outline"
            }
          >
            {item.activation === "deactivated"
              ? "Deactivated"
              : item.status || "Active"}
          </Badge>
        </div>
      ),
    },
  ];

  const filteredMarkupData = markupItems.filter((item) =>
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredPriceEditData = priceEditItems.filter((item) =>
    item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Leave costing detail page
  const handleCloseDetailsModal = () => {
    navigate("/app/sales/markup");
    setSelectedRecord(null);
    setRecordDetails(null);
    templateByProduct.clearTemplateByProductState();
    setOtherCostLines([
      {
        id: Date.now(),
        description: "",
        descriptionCode: "",
        amount: 0,
        other_type: "rate",
        rate: 0,
        percentage_basis: "all_items",
        type: "other", // Default to "other"
      },
      {
        id: Date.now() + 1,
        description: "",
        descriptionCode: "",
        amount: 0,
        other_type: "rate",
        rate: 0,
        percentage_basis: "all_items",
        type: "other", // Default to "other"
      },
    ]);
  };

  const loadProductionCostingRecord = (record) => {
    setSelectedRecord(record);
    // Initialize production date input from record or today (YYYY-MM-DD)
    const initialDate = record.production_date
      ? moment(record.production_date).format("YYYY-MM-DD")
      : moment().format("YYYY-MM-DD");
    setProductionDateInput(initialDate);

    // Clear shared costs first
    setSharedCosts([]);
    setSharedCostOutputPercentage(1);
    setSharedCostQtyUse(1);
    setSharedCostExpectedYieldPercent(null);
    templateByProduct.clearTemplateByProductState();

    // Parse and transform the data from production record
    let productionItemsData = [];
    let sharedCostsData = [];
    let outputValue = 1;
    let qtyUseValue = 1;
    let parsedData = null;
    const dataToParse = record.data || record.recordDetails || record;
    const isJointShared =
      record.costing_type === "joint_shared" ||
      record.type === "joint_shared" ||
      record.costingType === "joint_shared";

    console.log(
      "Opening record:",
      record.id,
      "isJointShared:",
      isJointShared,
      "dataToParse:",
      dataToParse,
    );

    if (dataToParse) {
      try {
        parsedData = dataToParse;

        // Handle string, object, or already parsed array
        if (typeof dataToParse === "string") {
          parsedData = JSON.parse(dataToParse);
        } else if (Array.isArray(dataToParse)) {
          // If it's already an array, use it directly
          productionItemsData = dataToParse;
          parsedData = null; // Skip object processing
        }

        // Some records persist payload under data.requestData.
        if (
          parsedData &&
          typeof parsedData === "object" &&
          !Array.isArray(parsedData) &&
          parsedData.requestData &&
          typeof parsedData.requestData === "object"
        ) {
          parsedData = parsedData.requestData;
        }

        // Check if this is a joint_shared structure or job_specific
        if (
          parsedData &&
          typeof parsedData === "object" &&
          !Array.isArray(parsedData)
        ) {
          console.log(
            "Parsed data structure:",
            Object.keys(parsedData),
            "has costingType:",
            parsedData.costingType,
            "has products:",
            !!parsedData.products,
            "has sharedCosts:",
            !!parsedData.sharedCosts,
            "isJointShared:",
            isJointShared,
          );

          // Check if it has a products array (for both joint_shared and job_specific)
          if (parsedData.products && Array.isArray(parsedData.products)) {
            const costingType = parsedData.costingType || "job_specific";

            if (costingType === "joint_shared" || isJointShared) {
              // Extract products array for joint_shared
              productionItemsData = parsedData.products;
              console.log(
                "Extracted productionItemsData for joint_shared:",
                productionItemsData.length,
                "items",
              );

              // Extract sharedCosts and output (only for joint_shared)
              if (
                parsedData.sharedCosts &&
                Array.isArray(parsedData.sharedCosts)
              ) {
                sharedCostsData = parsedData.sharedCosts;
                console.log(
                  "Extracted sharedCostsData from parsedData.sharedCosts:",
                  sharedCostsData,
                );
              }
              if (parsedData.output !== undefined) {
                outputValue = parseFloat(parsedData.output) || 1;
                setSharedCostOutputPercentage(outputValue);
                console.log("Set output value:", outputValue);
              }
              const expectedYield = parseTemplateExpectedYieldFromData(parsedData);
              if (expectedYield != null) {
                setSharedCostExpectedYieldPercent(expectedYield);
              }
              if (parsedData.qtyUse !== undefined) {
                qtyUseValue = parseFloat(parsedData.qtyUse) || 1;
                setSharedCostQtyUse(qtyUseValue);
                console.log("Set qtyUse value:", qtyUseValue);
              }
            } else if (costingType === "job_specific") {
              // Extract products array for job_specific
              productionItemsData = parsedData.products;
              console.log(
                "Extracted productionItemsData for job_specific:",
                productionItemsData.length,
                "items",
              );
            }
          }

          // If it's an object with a data field, extract it (for both joint_shared and job_specific)
          if (parsedData.data && productionItemsData.length === 0) {
            // If it's an object with a data field, extract it
            const extractedData =
              typeof parsedData.data === "string"
                ? JSON.parse(parsedData.data)
                : parsedData.data;

            // Check if extracted data is also joint_shared structure
            if (
              extractedData &&
              typeof extractedData === "object" &&
              !Array.isArray(extractedData)
            ) {
              const extractedCostingType =
                extractedData.costingType || "job_specific";

              // Check if extractedData has products array (for both joint_shared and job_specific)
              if (
                extractedData.products &&
                Array.isArray(extractedData.products)
              ) {
                if (extractedCostingType === "joint_shared" || isJointShared) {
                  productionItemsData = extractedData.products;
                  console.log(
                    "Extracted productionItemsData from extractedData.products (joint_shared):",
                    productionItemsData.length,
                    "items",
                  );
                  if (
                    extractedData.sharedCosts &&
                    Array.isArray(extractedData.sharedCosts)
                  ) {
                    sharedCostsData = extractedData.sharedCosts;
                    console.log(
                      "Extracted sharedCostsData from extractedData.sharedCosts:",
                      sharedCostsData,
                    );
                  }
                  if (extractedData.output !== undefined) {
                    outputValue = parseFloat(extractedData.output) || 1;
                    setSharedCostOutputPercentage(outputValue);
                  }
                  const expectedYield =
                    parseTemplateExpectedYieldFromData(extractedData);
                  if (expectedYield != null) {
                    setSharedCostExpectedYieldPercent(expectedYield);
                  }
                  if (extractedData.qtyUse !== undefined) {
                    qtyUseValue = parseFloat(extractedData.qtyUse) || 1;
                    setSharedCostQtyUse(qtyUseValue);
                  }
                } else if (extractedCostingType === "job_specific") {
                  productionItemsData = extractedData.products;
                  console.log(
                    "Extracted productionItemsData from extractedData.products (job_specific):",
                    productionItemsData.length,
                    "items",
                  );
                }
              } else if (Array.isArray(extractedData)) {
                // For job_specific, extractedData might be an array
                productionItemsData = extractedData;
                console.log(
                  "Extracted productionItemsData from parsedData.data (array):",
                  productionItemsData.length,
                  "items",
                );
              } else {
                // Single object, wrap in array
                productionItemsData = [extractedData];
                console.log(
                  "Extracted productionItemsData from parsedData.data (object):",
                  productionItemsData.length,
                  "items",
                );
              }
            } else if (Array.isArray(extractedData)) {
              // For job_specific, data field might contain an array directly
              productionItemsData = extractedData;
              console.log(
                "Extracted productionItemsData from parsedData.data (direct array):",
                productionItemsData.length,
                "items",
              );
            } else if (extractedData) {
              productionItemsData = [extractedData];
              console.log(
                "Extracted productionItemsData from parsedData.data (single):",
                productionItemsData.length,
                "items",
              );
            }
          } else if (
            Array.isArray(parsedData) &&
            productionItemsData.length === 0
          ) {
            // If parsedData is already an array (job_specific format)
            productionItemsData = parsedData;
            console.log(
              "Using parsedData as array (job_specific):",
              productionItemsData.length,
              "items",
            );
          } else if (productionItemsData.length === 0) {
            // For job_specific, if we haven't found productionItems yet, check if parsedData itself is a production item
            if (!isJointShared && parsedData.finishedGoods) {
              // This looks like a single production item object
              productionItemsData = [parsedData];
              console.log(
                "Using parsedData as single production item (job_specific):",
                productionItemsData.length,
                "items",
              );
            } else if (
              !isJointShared &&
              !parsedData.products &&
              !parsedData.sharedCosts
            ) {
              // If it's not joint_shared and doesn't have joint_shared structure, treat as production item
              productionItemsData = [parsedData];
              console.log(
                "Using parsedData as production item (fallback):",
                productionItemsData.length,
                "items",
              );
            }
          }

          // If it's joint_shared but we haven't found sharedCosts yet, try to find them in the parsedData
          if (
            isJointShared &&
            sharedCostsData.length === 0 &&
            parsedData.sharedCosts &&
            Array.isArray(parsedData.sharedCosts)
          ) {
            sharedCostsData = parsedData.sharedCosts;
            console.log(
              "Found sharedCostsData in parsedData after initial check:",
              sharedCostsData,
            );
          }
        }
      } catch (e) {
        console.error(
          "Error parsing production record data:",
          e,
          "dataToParse:",
          dataToParse,
        );
        productionItemsData = [];
      }
    } else {
      console.warn(
        "dataToParse is null or undefined. record.data:",
        record.data,
        "record.recordDetails:",
        record.recordDetails,
      );
    }

    // Final fallback: if still no data, try record.data one more time with different approach
    if (productionItemsData.length === 0 && record.data) {
      console.log(
        "Final fallback: trying to extract from record.data directly",
      );
      try {
        let finalData = record.data;
        if (typeof finalData === "string") {
          finalData = JSON.parse(finalData);
        }

        // Check all possible structures
        if (Array.isArray(finalData)) {
          productionItemsData = finalData;
          console.log(
            "Final fallback: extracted array from record.data:",
            productionItemsData.length,
          );
        } else if (finalData && typeof finalData === "object") {
          if (
            finalData.requestData &&
            typeof finalData.requestData === "object"
          ) {
            finalData = finalData.requestData;
          }

          if (finalData.products && Array.isArray(finalData.products)) {
            productionItemsData = finalData.products;
            console.log(
              "Final fallback: extracted products array:",
              productionItemsData.length,
            );
          } else if (
            finalData.productionItems &&
            Array.isArray(finalData.productionItems)
          ) {
            productionItemsData = finalData.productionItems;
            console.log(
              "Final fallback: extracted productionItems array:",
              productionItemsData.length,
            );
          } else if (finalData.finishedGoods || finalData.ingredients) {
            productionItemsData = [finalData];
            console.log(
              "Final fallback: wrapped single object:",
              productionItemsData.length,
            );
          }
        }
      } catch (e) {
        console.error("Final fallback error:", e);
      }
    }

    // Transform production items data into the expected structure
    // Determine costing type from parsed data
    let dataCostingType = "job_specific";
    if (
      parsedData &&
      typeof parsedData === "object" &&
      !Array.isArray(parsedData)
    ) {
      if (parsedData.costingType) {
        dataCostingType = parsedData.costingType;
      } else if (isJointShared) {
        dataCostingType = "joint_shared";
      }
    } else if (isJointShared) {
      dataCostingType = "joint_shared";
    }

    console.log(
      "Determined dataCostingType:",
      dataCostingType,
      "productionItemsData.length:",
      productionItemsData.length,
      "productionItemsData:",
      productionItemsData,
    );

    // If productionItemsData is still empty, try to extract from record.data one more time
    if (productionItemsData.length === 0 && record.data) {
      console.log(
        "productionItemsData is empty, trying to extract from record.data again",
      );
      try {
        let recordData = record.data;
        if (typeof recordData === "string") {
          recordData = JSON.parse(recordData);
        }

        if (
          recordData &&
          typeof recordData === "object" &&
          !Array.isArray(recordData) &&
          recordData.requestData &&
          typeof recordData.requestData === "object"
        ) {
          recordData = recordData.requestData;
        }

        // If it's an array, use it directly
        if (Array.isArray(recordData)) {
          productionItemsData = recordData;
          console.log(
            "Extracted productionItemsData from record.data (array):",
            productionItemsData.length,
          );
        }
        // If it has products array, extract it
        else if (recordData.products && Array.isArray(recordData.products)) {
          productionItemsData = recordData.products;
          console.log(
            "Extracted productionItemsData from record.data.products:",
            productionItemsData.length,
          );
        }
        // If it's a single object with finishedGoods, wrap it
        else if (recordData.finishedGoods || recordData.ingredients) {
          productionItemsData = [recordData];
          console.log(
            "Extracted productionItemsData from record.data (single object):",
            productionItemsData.length,
          );
        }
      } catch (e) {
        console.error("Error extracting from record.data:", e);
      }
    }

    const productionItems = Array.isArray(productionItemsData)
      ? productionItemsData.map((item, idx) => {
          console.log("item===========>", item);
          // For joint_shared, use product-level units as multiplierValue
          const productUnits = item.units ? parseFloat(item.units) : null;
          const productQty = item.productQty
            ? parseFloat(item.productQty)
            : null;
          // For joint_shared, convert items array to ingredients
          // joint_shared structure: { productId, productName, items: [...] }
          // job_specific structure: { id, finishedGoods: [...], ingredients: [...] }
          const ingredientsSource =
            dataCostingType === "joint_shared" && item.items
              ? item.items // Use items array for joint_shared
              : item.ingredients || []; // Use ingredients array for job_specific

          // For joint_shared, create finishedGoods from productId/productName/productSku
          // if finishedGoods array is not present
          let finishedGoodsArray = normalizeFinishedGoodsList(
            item.finishedGoods,
          );
          const productionFgSource = finishedGoodsArray[0] || {};
          if (
            dataCostingType === "joint_shared" &&
            finishedGoodsArray.length === 0 &&
            (item.productId || item.productName || item.productSku)
          ) {
            // Find the finished good product from finishedGoodProducts
            const finishedGoodProduct = resolveFinishedGoodFromFgRow(
              {
                productId: item.productId,
                productSku: item.productSku,
                productName: item.productName,
              },
              finishedGoodProducts,
            );
            if (finishedGoodProduct) {
              finishedGoodsArray = [
                {
                  id: productionFgSource.id || `fg-${idx}`,
                  finishedGood:
                    productionFgSource.finishedGood || finishedGoodProduct,
                  quantity:
                    productQty !== null
                      ? productQty
                      : (productionFgSource.quantity ?? item.units ?? 0),
                  units: productionFgSource.units ?? item.units,
                  unitOfMeasure:
                    productionFgSource.unitOfMeasure ||
                    finishedGoodProduct.unit_of_measure ||
                    "",
                  goodQuantity: productionFgSource.goodQuantity,
                  wasteQuantity: productionFgSource.wasteQuantity,
                  wasteType: productionFgSource.wasteType,
                  wasteReason: productionFgSource.wasteReason,
                  wasteScrapByProductSelection:
                    productionFgSource.wasteScrapByProductSelection,
                  multiplierValue: productionFgSource.multiplierValue,
                },
              ];
            }
          }

          const latestSession =
            Array.isArray(parsedData?.sessionHistory) &&
            parsedData.sessionHistory.length > 0
              ? parsedData.sessionHistory[parsedData.sessionHistory.length - 1]
              : null;

          let fgRowsForMapping = (finishedGoodsArray || []).map((fg) =>
            enrichFinishedGoodRowWithProductContext(fg, item),
          );
          const wasteRowFromPayload = (() => {
            const w = item.waste;
            if (w == null) return null;
            if (Array.isArray(w)) return w.length > 0 ? w[0] : null;
            if (typeof w === "object") return w;
            return null;
          })();
          if (wasteRowFromPayload && typeof wasteRowFromPayload === "object") {
            const wMatch = wasteRowFromPayload;
            const wq =
              parseFloat(
                String(
                  wMatch.wasteQuantity ??
                    wMatch.waste_quantity ??
                    wMatch.qty ??
                    "",
                ).replace(/,/g, ""),
              ) || 0;
            if (wq > 0) {
              fgRowsForMapping = fgRowsForMapping.map((fg) => {
                const fgSku =
                  String(fg.sku || "").trim() ||
                  String(
                    fg.finishedGood?.item_code ||
                      fg.finishedGood?.itemCode ||
                      fg.finishedGood?.sku ||
                      fg.finishedGood?.SKU ||
                      "",
                  ).trim();
                if (!fgSku) return fg;
                const wasteSku = String(wMatch.sku || "").trim();
                if (
                  !wasteSku ||
                  wasteSku.toLowerCase() !== fgSku.toLowerCase()
                ) {
                  return fg;
                }
                return {
                  ...fg,
                  wasteQuantity: wq,
                  wasteType: wMatch.wasteType ?? wMatch.waste_type ?? "",
                  wasteReason: wMatch.wasteReason || wMatch.waste_reason || "",
                  wasteScrapSellingPrice:
                    wMatch.scrap_selling_price != null
                      ? wMatch.scrap_selling_price
                      : wMatch.selling_price != null
                        ? wMatch.selling_price
                        : fg.wasteScrapSellingPrice,
                  wasteScrapMarkUp:
                    wMatch.scrap_mark_up != null
                      ? wMatch.scrap_mark_up
                      : wMatch.mark_up != null
                        ? wMatch.mark_up
                        : fg.wasteScrapMarkUp,
                  wasteScrapMarkupMode:
                    wMatch.scrap_markup_mode ||
                    wMatch.markup_mode ||
                    fg.wasteScrapMarkupMode,
                  wasteScrapVatRate:
                    wMatch.scrap_vat_rate != null
                      ? wMatch.scrap_vat_rate
                      : wMatch.vat_rate != null
                        ? wMatch.vat_rate
                        : fg.wasteScrapVatRate,
                  wasteScrapApplyVat:
                    wMatch.scrap_apply_vat === false
                      ? false
                      : wMatch.scrap_apply_vat === true
                        ? true
                        : wMatch.apply_vat === false
                          ? false
                          : wMatch.apply_vat === true
                            ? true
                            : fg.wasteScrapApplyVat,
                  wasteAbnormalLossExpenseSelection: (() => {
                    const code = String(
                      wMatch.abnormal_loss_account_code ??
                        wMatch.abnormalLossAccountCode ??
                        "",
                    ).trim();
                    if (!code || !expenseList?.length) {
                      return fg.wasteAbnormalLossExpenseSelection;
                    }
                    const m = expenseList.find(
                      (e) => String(e.code || "").trim() === code,
                    );
                    return m ? [m] : fg.wasteAbnormalLossExpenseSelection;
                  })(),
                  wasteScrapByProductSelection: (() => {
                    const sc = wMatch.scrap;
                    if (
                      !sc ||
                      typeof sc !== "object" ||
                      !scrapByProductOptions?.length
                    ) {
                      return fg.wasteScrapByProductSelection;
                    }
                    const sSku = String(sc.sku || "").trim();
                    if (!sSku) return fg.wasteScrapByProductSelection;
                    const p = scrapByProductOptions.find(
                      (x) => String(x.sku || x.item_code || "").trim() === sSku,
                    );
                    return p ? [p] : fg.wasteScrapByProductSelection;
                  })(),
                };
              });
            }
          }

          return {
            id: item.id || `production-item-${idx}`,
            units: item.units, // Preserve units field for joint_shared products
            productQty: item.productQty,
            finishedGoods: fgRowsForMapping.map((fg) => {
              const fgForResolve = enrichFinishedGoodRowWithProductContext(
                fg,
                item,
              );
              // Extract multiplier value - prioritize multiplier object over multiplierValue field
              // This ensures we use the correct value from the multiplier object when loading existing data
              let multiplierValue = 1.0;

              if (
                fg.multiplierValue !== undefined &&
                fg.multiplierValue !== null &&
                String(fg.multiplierValue).trim() !== ""
              ) {
                multiplierValue = parseFloat(fg.multiplierValue) || 1.0;
              } else if (fg.multiplier?.multiplier_value) {
                multiplierValue = parseFloat(fg.multiplier.multiplier_value);
              } else if (
                dataCostingType === "joint_shared" &&
                fg.units !== undefined &&
                fg.units !== null
              ) {
                multiplierValue = parseFloat(fg.units) || 1.0;
              } else if (
                dataCostingType === "joint_shared" &&
                productUnits !== null
              ) {
                multiplierValue = productUnits;
              }

              const multiplierId =
                fg.multiplier_id ?? fg.multiplierId ?? fg.multiplier?.id;
              // Prefer per–finished-good goodQuantity from API. productQty is often total
              // (good + waste) from Record Production; for normal waste, do not use it as
              // the costing denominator when good + waste are stored separately.
              const wasteQtyParsed =
                parseFloat(
                  fg.wasteQuantity !== undefined && fg.wasteQuantity !== null
                    ? String(fg.wasteQuantity).replace(/,/g, "")
                    : 0,
                ) || 0;
              const wasteTypeParsed = String(
                (typeof fg.wasteType === "string"
                  ? fg.wasteType
                  : fg.wasteType?.value || fg.wasteType?.label) ||
                  fg.waste_type ||
                  "normal",
              )
                .trim()
                .toLowerCase();
              const fgGoodRaw = fg.goodQuantity;
              const fgRunGoodRaw =
                fg.runGoodQuantity ??
                fg.currentGoodQuantity ??
                fg.current_good_quantity;
              const fgRunWasteRaw =
                fg.runWasteQuantity ??
                fg.currentWasteQuantity ??
                fg.current_waste_quantity;
              const runGoodFromFg = Number(
                parseFloat(fgRunGoodRaw ?? NaN).toFixed(4),
              );
              const runWasteFromFg = Number(
                parseFloat(fgRunWasteRaw ?? NaN).toFixed(4),
              );
              const hasRunGoodFromFg = !Number.isNaN(runGoodFromFg);
              const hasRunWasteFromFg = !Number.isNaN(runWasteFromFg);

              const canUseSessionRunFallback =
                Number.isFinite(parseFloat(latestSession?.goodQty)) &&
                Number.isFinite(parseFloat(latestSession?.brokenQty)) &&
                productionItemsData.length === 1 &&
                fgRowsForMapping.length === 1;
              const hasFgGood =
                fgGoodRaw !== undefined &&
                fgGoodRaw !== null &&
                String(fgGoodRaw).trim() !== "";

              let qtyValue;
              if (hasRunGoodFromFg) {
                qtyValue = runGoodFromFg;
              } else if (canUseSessionRunFallback) {
                qtyValue = parseFloat(latestSession?.goodQty) || 0;
              } else if (hasFgGood) {
                qtyValue = parseFloat(fgGoodRaw) || 0;
              } else if (productQty !== null) {
                if (
                  wasteQtyParsed > 0 &&
                  (wasteTypeParsed === "normal" || wasteTypeParsed === "")
                ) {
                  qtyValue = Math.max(0, productQty - wasteQtyParsed);
                } else {
                  qtyValue = productQty;
                }
              } else if (fg.quantity !== undefined) {
                qtyValue = parseFloat(fg.quantity) || 0;
              } else if (fg.units !== undefined) {
                qtyValue = parseFloat(fg.units) || 0;
              } else {
                qtyValue = 0;
              }
              return {
                id: fg.id || `fg-${idx}`,
                finishedGood: resolveFinishedGoodFromFgRow(
                  fgForResolve,
                  finishedGoodProducts,
                ),
                quantity: qtyValue,
                quantity_formatted: qtyValue
                  ? formatNumberWithCommas(qtyValue.toString())
                  : "",
                goodQuantity: qtyValue,
                goodQuantity_formatted: qtyValue
                  ? formatNumberWithCommas(qtyValue.toString())
                  : "0.0000",
                wasteQuantity: (() => {
                  const resolved = hasRunWasteFromFg
                    ? runWasteFromFg
                    : canUseSessionRunFallback
                      ? parseFloat(latestSession?.brokenQty) || 0
                      : fg.wasteQuantity !== undefined &&
                          fg.wasteQuantity !== null
                        ? fg.wasteQuantity
                        : "0.0000";
                  return resolved;
                })(),
                wasteType: resolveCostingWasteTypeForLoad(fg, {
                  item,
                  parsedData,
                  wasteRowFromPayload,
                }),
                wasteReason: fg.wasteReason || fg.waste_reason || "",
                wasteScrapByProductSelection: Array.isArray(
                  fg.wasteScrapByProductSelection,
                )
                  ? fg.wasteScrapByProductSelection
                  : [],
                wasteAbnormalLossExpenseSelection: Array.isArray(
                  fg.wasteAbnormalLossExpenseSelection,
                )
                  ? fg.wasteAbnormalLossExpenseSelection
                  : [],
                wasteScrapSellingPrice:
                  fg.wasteScrapSellingPrice ??
                  fg.waste_scrap_selling_price ??
                  "",
                wasteScrapVatRate:
                  fg.wasteScrapVatRate ??
                  fg.waste_scrap_vat_rate ??
                  fg.vat_rate ??
                  "7.5",
                wasteScrapApplyVat:
                  fg.wasteScrapApplyVat === false ||
                  fg.waste_scrap_apply_vat === false
                    ? false
                    : true,
                wasteScrapMarkupMode:
                  fg.wasteScrapMarkupMode ??
                  fg.waste_scrap_markup_mode ??
                  "percentage",
                wasteScrapMarkUp:
                  fg.wasteScrapMarkUp ?? fg.waste_scrap_mark_up ?? "",
                batchNo:
                  fg.batchNo || record.batch_id || record.batch_no || record.id,
                warehouse: fg.warehouse || "",
                unitOfMeasure: fg.unitOfMeasure || fg.unit || "",
                category: fg.category || "",
                multiplier: fg.multiplier || null,
                multiplier_id: multiplierId ?? null,
                multiplierValue: multiplierValue,
                expiry_date: fg.expiry_date || "",
                mark_up: fg.mark_up ?? "",
                markup_mode: fg.markup_mode || "percentage",
                vat_rate: fg.vat_rate ?? "7.5",
                branchLocationId:
                  fg.branchLocationId ?? fg.branch_location_id ?? null,
                branch_id: fg.branch_id ?? "",
                branch_name: fg.branch_name ?? "",
                apply_vat: fg.apply_vat === undefined ? true : fg.apply_vat,
              };
            }),
            ingredients: ingredientsSource.map((ing, ingIdx) => {
              // Log to debug what we're receiving from API
              if (
                !ing.type &&
                !ing.product &&
                (ing.description || ing.descriptionCode)
              ) {
                console.log(
                  "Found ingredient without type or product but with description:",
                  ing,
                );
              }

              // For joint_shared format, items may have rawMaterialId/rawMaterialSku instead of product object
              // Find the product from rawMaterialProducts if we have rawMaterialId/rawMaterialSku
              let product = ing.product || null;
              if (!product && (ing.rawMaterialId || ing.rawMaterialSku)) {
                product =
                  rawMaterialProducts.find(
                    (rm) =>
                      String(rm.id) === String(ing.rawMaterialId) ||
                      String(rm.product_id) === String(ing.rawMaterialId) ||
                      String(rm.sku) === String(ing.rawMaterialSku) ||
                      String(rm.item_code) === String(ing.rawMaterialSku) ||
                      rm.item_name === ing.rawMaterialName ||
                      rm.item_name === ing.description,
                  ) || null;
              }
              const unitCost = resolveMaterialUnitCostFromValuation({
                ...ing,
                product,
              });

              // Determine type - preserve from API data or infer from structure
              // Check for type in various possible fields
              let ingType =
                ing.type || ing.ingredientType || ing.ingredient_type || null;
              if (!ingType) {
                // Infer type from data structure
                // Priority: Check for description/account fields first (these indicate "other" type)
                if (
                  ing.descriptionCode ||
                  ing.description_code ||
                  ing.account_head ||
                  ing.accountHead ||
                  ing.description
                ) {
                  // Has account/description = could be "other" or "by_product_credit"
                  // Check if it's explicitly marked as by_product_credit
                  ingType =
                    ing.type === "by_product_credit" ||
                    ing.ingredientType === "by_product_credit"
                      ? "by_product_credit"
                      : "other";
                } else if (
                  product &&
                  !ing.descriptionCode &&
                  !ing.account_head
                ) {
                  // Has product but no account/description code = raw_material
                  ingType = "raw_material";
                } else {
                  // Default to raw_material if product exists, otherwise other
                  ingType = product ? "raw_material" : "other";
                }
              }
              // Ensure type is one of the valid values
              if (
                !["raw_material", "by_product_credit", "other"].includes(
                  ingType,
                )
              ) {
                ingType = product ? "raw_material" : "other";
              }

              const quantity = parseFloat(ing.quantity || 0);

              // Calculate amount based on type
              let amount = 0;
              if (ingType === "raw_material") {
                amount = quantity * unitCost;
              } else {
                // For other types, amount will be recalculated after all ingredients are loaded
                // using the same logic as handleUpdateIngredient
                const inputType = ing.other_type || "rate";
                if (inputType === "rate") {
                  amount = getOtherRateLineAmount(item, ing.rate);
                }
                // Percentage-based amounts will be calculated later with running totals
              }

              return {
                id: ing.id || `ingredient-${idx}-${ingIdx}`,
                type: ingType,
                product: product,
                quantity: quantity,
                unitOfMeasure: ing.unitOfMeasure || "",
                availableQty: ing.availableQty || 0,
                unit_cost: unitCost,
                cost_price: unitCost, // Keep for backward compatibility
                description: ing.description || ing.description_name || "",
                descriptionCode:
                  ing.descriptionCode || ing.description_code || ing.code || "",
                account_head:
                  ing.account_head ||
                  ing.accountHead ||
                  ing.account_head_name ||
                  "",
                other_type:
                  ing.other_type ||
                  ing.otherType ||
                  (ingType !== "raw_material" ? "rate" : ""),
                rate: ing.rate || ing.rate_amount || "",
                percentage_basis:
                  (ing.percentage_basis || ing.percentageBasis) ===
                  "raw_material"
                    ? "all_items"
                    : ing.percentage_basis ||
                      ing.percentageBasis ||
                      "all_items",
                amount: amount, // Store calculated amount
                expectedQuantity: (() => {
                  const existing =
                    ing.expectedQuantity ?? ing.expected_qty ?? ing.expectedQty;
                  if (
                    existing !== undefined &&
                    existing !== null &&
                    String(existing).trim() !== ""
                  ) {
                    return existing;
                  }
                  const der = getRecordProductionStyleIngredientExpectedQty(
                    fgRowsForMapping,
                    {
                      ...ing,
                      quantity,
                      type: ingType,
                    },
                  );
                  return der != null ? String(der) : "";
                })(),
                actualQuantity: (() => {
                  const existing = getStoredMaterialActualQtyRaw(ing);
                  if (
                    existing !== undefined &&
                    existing !== null &&
                    String(existing).trim() !== ""
                  ) {
                    return existing;
                  }
                  return "";
                })(),
                actualQty: (() => {
                  const existing = getStoredMaterialActualQtyRaw(ing);
                  if (
                    existing !== undefined &&
                    existing !== null &&
                    String(existing).trim() !== ""
                  ) {
                    return existing;
                  }
                  return "";
                })(),
              };
            }),
          };
        })
      : [];

    // Recalculate amounts for all ingredients with running totals
    // This ensures percentage-based amounts are calculated correctly
    const productionItemsWithAmounts = productionItems.map((item) => {
      // Calculate raw materials total for this production item
      const rawMaterialsTotal = (item.ingredients || [])
        .filter((ing) => isMaterialType(getNormalizedIngredientType(ing)))
        .reduce(
          (sum, ing) =>
            sum +
            resolveMaterialActualQtyForBalance(item, ing) *
              parseFloat(ing.unit_cost || ing.cost_price || 0),
          0,
        );

      let runningTotal = rawMaterialsTotal;
      const ingredientsWithAmounts = (item.ingredients || []).map((ing) => {
        const ingType = getNormalizedIngredientType(ing);
        const inputType = ing.other_type || "rate";
        let amount = 0;

        if (isMaterialType(ingType)) {
          amount =
            resolveMaterialActualQtyForBalance(item, ing) *
            parseFloat(ing.unit_cost || ing.cost_price || 0);
        } else if (inputType === "rate") {
          amount = getOtherRateLineAmount(item, ing.rate);
        } else if (inputType === "percentage") {
          const pct = parseFloat(ing.quantity || 0);
          const basis = ing.percentage_basis || "all_items";
          if (basis === "raw_material") {
            amount = (pct / 100) * rawMaterialsTotal;
          } else if (basis === "all_items") {
            amount = (pct / 100) * runningTotal;
          }
        }

        const updatedIng = { ...ing, amount };

        // Update running total
        if (ingType === "by_product_credit") {
          runningTotal -= amount;
        } else if (!isMaterialType(ingType)) {
          runningTotal += amount;
        }

        return updatedIng;
      });

      return {
        ...item,
        ingredients: ingredientsWithAmounts,
      };
    });

    // Extract unique SKUs from finished goods and collect multipliers from existing data
    const uniqueSKUs = new Set();
    const existingMultipliers = [];

    productionItemsWithAmounts.forEach((item) => {
      if (item.finishedGoods && Array.isArray(item.finishedGoods)) {
        item.finishedGoods.forEach((fg) => {
          const finishedGood = fg.finishedGood || null;
          if (finishedGood) {
            const sku =
              finishedGood.item_code ||
              finishedGood.itemCode ||
              finishedGood.sku ||
              finishedGood.SKU;
            if (sku) {
              uniqueSKUs.add(sku);
            }
          }
          // Collect multipliers from existing data
          if (fg.multiplier && fg.multiplier.id) {
            const existingMultiplier = existingMultipliers.find(
              (m) => m.id === fg.multiplier.id,
            );
            if (!existingMultiplier) {
              existingMultipliers.push(fg.multiplier);
            }
          }
        });
      }
    });

    // Add existing multipliers to state immediately
    if (existingMultipliers.length > 0) {
      setAllMultipliers((prev) => {
        const combined = [...prev];
        existingMultipliers.forEach((multiplier) => {
          if (!combined.find((m) => m.id === multiplier.id)) {
            combined.push(multiplier);
          }
        });
        return combined;
      });
    }

    // Fetch multipliers for all unique SKUs
    if (uniqueSKUs.size > 0 && activeBusiness?.id) {
      uniqueSKUs.forEach((sku) => {
        setTimeout(() => {
          fetchProductsWithMultipliers(String(sku));
        }, 100);
      });
    }

    // Extract finished goods and raw materials from production items
    const finishedGoods = [];
    const rawMaterials = [];

    productionItemsWithAmounts.forEach((item) => {
      // Add finished goods - use default values from the parsed data
      if (item.finishedGoods && Array.isArray(item.finishedGoods)) {
        item.finishedGoods.forEach((fg) => {
          const finishedGood = fg.finishedGood || fg.product || null;
          // For joint_shared, units might be in fg.units, otherwise use quantity
          const quantity = fg.units !== undefined ? fg.units : fg.quantity || 0;
          finishedGoods.push({
            product: finishedGood,
            qty_in: getNumericQuantity(quantity),
            product_id:
              finishedGood?.item_code || finishedGood?.id || fg.product_id,
            item_name: finishedGood?.item_name || fg.item_name,
            unit_of_measure:
              fg.unitOfMeasure ||
              fg.unit ||
              finishedGood?.unit_of_measure ||
              "",
            category: fg.category || finishedGood?.category || "",
            cost_price: parseFloat(
              finishedGood?.cost_price || fg.cost_price || 0,
            ),
            batchNo: fg.batchNo || record.id,
            warehouse: fg.warehouse || "",
          });
        });
      }

      // Add raw materials (ingredients) - use default values from the parsed data
      if (item.ingredients && Array.isArray(item.ingredients)) {
        item.ingredients.forEach((ing) => {
          const product = ing.product || ing.rawMaterial || null;
          rawMaterials.push({
            product: product,
            qty_out: parseFloat(ing.quantity) || 0,
            product_id:
              product?.sku ||
              product?.item_code ||
              product?.id ||
              ing.product_id,
            item_name: product?.item_name || ing.item_name,
            unit_of_measure:
              ing.unitOfMeasure || product?.unit_of_measure || "",
            category: product?.category || ing.category || "",
            cost_price: parseFloat(
              ing.cost_price || product?.unit_cost || product?.cost_price || 0,
            ),
            availableQty: parseFloat(ing.availableQty || product?.balance || 0),
          });
        });
      }
    });

    // Log production items before setting
    console.log(
      "Transformed productionItems:",
      productionItems.length,
      "items",
      productionItems,
    );

    // Use productionItemsWithAmounts (with calculated amounts) - don't create empty placeholders
    let finalProductionItems = mergeProductionWasteFromManufacturingData(
      productionItemsWithAmounts,
      parsedData,
    );

    if (finalProductionItems.length === 0) {
      console.warn(
        "No production items found after transformation. Record data:",
        record.data,
        "record.type:",
        record.type,
        "record.costing_type:",
        record.costing_type,
      );
    }

    console.log(
      "Setting recordDetails with finalProductionItems:",
      finalProductionItems.length,
      "items",
      finalProductionItems,
    );

    if (isJointShared && finalProductionItems.length > 0) {
      const totalMult = computeTotalMultiplierFromItems(finalProductionItems);
      if (totalMult > 0 && Math.abs(outputValue - totalMult) > 0.05) {
        outputValue = parseFloat(totalMult.toFixed(4));
        setSharedCostOutputPercentage(outputValue);
      }
    }

    setRecordDetails({
      finishedGoods,
      rawMaterials,
      entries: [],
      productionItems: finalProductionItems,
    });

    const manufacturingBatchRef =
      record.batch_no ||
      record.batch_id ||
      parsedData?.batchNo ||
      parsedData?.batch_no;
    if (manufacturingBatchRef && activeBusiness?.id) {
      _fetchApi(
        `/api/production/manufacturing-records?facilityId=${activeBusiness.id}&page=1&limit=1000`,
        (resp) => {
          if (!resp?.success) return;
          const mfgRecord = (resp.data?.productionRecords || []).find(
            (r) =>
              String(r.id) === String(manufacturingBatchRef) ||
              String(r.batch_no) === String(manufacturingBatchRef),
          );
          if (!mfgRecord?.data) return;
          try {
            let mfgData =
              typeof mfgRecord.data === "string"
                ? JSON.parse(mfgRecord.data)
                : mfgRecord.data;
            if (mfgData?.requestData) mfgData = mfgData.requestData;
            setRecordDetails((prev) => {
              if (!prev?.productionItems?.length) return prev;
              return {
                ...prev,
                productionItems: mergeProductionWasteFromManufacturingData(
                  prev.productionItems,
                  mfgData,
                ),
              };
            });
            if (isJointShared && mfgData?.templateByProduct) {
              templateByProduct.applyTemplateByProductFromRecord(
                { data: mfgData },
                mfgData,
              );
            }
          } catch (e) {
            console.warn(
              "Could not hydrate waste type from manufacturing record:",
              e,
            );
          }
        },
      );
    }

    if (isJointShared) {
      setTimeout(() => {
        templateByProduct.applyTemplateByProductFromRecord(record, parsedData);
      }, 50);
    }

    // Auto-expand first production item
    if (finalProductionItems.length > 0) {
      setExpandedProductionItem(finalProductionItems[0].id);
      console.log("Auto-expanded production item:", finalProductionItems[0].id);
    } else {
      console.warn(
        "No production items to expand. finalProductionItems is empty.",
      );
    }

    // Load costing templates and populate other costs if job_product_costing
    // Use finalProductionItems instead of productionItems to ensure we have the transformed data
    // Only load if we have production items AND the costing method is job_product_costing
    if (activeBusiness?.costing_method === "job_product_costing") {
      if (finalProductionItems.length > 0) {
        // Use setTimeout to ensure recordDetails is set first, then load templates
        setTimeout(() => {
          console.log(
            "Loading costing templates for finalProductionItems:",
            finalProductionItems.length,
            "items",
          );
          try {
            loadCostingTemplatesAndPopulateOtherCosts(finalProductionItems);
          } catch (error) {
            console.error(
              "Error calling loadCostingTemplatesAndPopulateOtherCosts:",
              error,
            );
          }
        }, 200);
      } else {
        console.warn(
          "Cannot load costing templates: finalProductionItems is empty. productionItems.length:",
          productionItems.length,
        );
      }
    } else {
      console.log(
        "Skipping costing templates load - costing_method is not job_product_costing:",
        activeBusiness?.costing_method,
      );
    }

    // Load shared costs if joint_shared costing type
    console.log(
      "Loading shared costs - isJointShared:",
      isJointShared,
      "sharedCostsData.length:",
      sharedCostsData.length,
      "record.data:",
      record.data,
    );

    // If sharedCostsData is empty but it's joint_shared, try multiple ways to extract
    if (isJointShared && sharedCostsData.length === 0) {
      console.log(
        "sharedCostsData is empty, trying to extract from record.data directly",
      );

      // Try record.data first
      try {
        let recordData = record.data;
        if (typeof recordData === "string") {
          recordData = JSON.parse(recordData);
        }
        if (recordData && typeof recordData === "object") {
          if (recordData.sharedCosts && Array.isArray(recordData.sharedCosts)) {
            sharedCostsData = recordData.sharedCosts;
            console.log(
              "Extracted sharedCostsData from record.data.sharedCosts:",
              sharedCostsData,
            );
          }
          if (recordData.output !== undefined) {
            outputValue = parseFloat(recordData.output) || 1;
            setSharedCostOutputPercentage(outputValue);
          }
          const expectedYield =
            parseTemplateExpectedYieldFromData(recordData);
          if (expectedYield != null) {
            setSharedCostExpectedYieldPercent(expectedYield);
          }
          if (recordData.qtyUse !== undefined) {
            qtyUseValue = parseFloat(recordData.qtyUse) || 1;
            setSharedCostQtyUse(qtyUseValue);
          }
        }
      } catch (e) {
        console.error("Error extracting sharedCosts from record.data:", e);
      }

      // If still empty, try record.recordDetails
      if (sharedCostsData.length === 0 && record.recordDetails) {
        try {
          let recordDetails = record.recordDetails;
          if (typeof recordDetails === "string") {
            recordDetails = JSON.parse(recordDetails);
          }
          if (
            recordDetails &&
            typeof recordDetails === "object" &&
            recordDetails.sharedCosts &&
            Array.isArray(recordDetails.sharedCosts)
          ) {
            sharedCostsData = recordDetails.sharedCosts;
            console.log(
              "Extracted sharedCostsData from record.recordDetails.sharedCosts:",
              sharedCostsData,
            );
          }
          if (recordDetails && typeof recordDetails === "object") {
            if (recordDetails.output !== undefined) {
              outputValue = parseFloat(recordDetails.output) || 1;
              setSharedCostOutputPercentage(outputValue);
            }
            const expectedYield =
              parseTemplateExpectedYieldFromData(recordDetails);
            if (expectedYield != null) {
              setSharedCostExpectedYieldPercent(expectedYield);
            }
            if (recordDetails.qtyUse !== undefined) {
              qtyUseValue = parseFloat(recordDetails.qtyUse) || 1;
              setSharedCostQtyUse(qtyUseValue);
            }
          }
        } catch (e) {
          console.error(
            "Error extracting sharedCosts from record.recordDetails:",
            e,
          );
        }
      }
    }

    // Process shared costs if we have any
    if (isJointShared && sharedCostsData.length > 0) {
      console.log(
        "Processing sharedCostsData:",
        sharedCostsData,
        "rawMaterialProducts.length:",
        rawMaterialProducts.length,
      );

      // Transform shared costs for display in the shared costs section
      const transformedSharedCosts = sharedCostsData.map((cost, index) => {
        // Find the raw material product if it's a raw material type
        let product = null;
        let matchedInWip = false;
        if ((cost.type || "raw_material") === "raw_material") {
          const resolved = resolveLiveWipProductForSharedCost(
            cost,
            rawMaterialProducts,
          );
          product = resolved.product;
          matchedInWip = resolved.matchedInWip;
        }

        const otherType = cost.otherType || cost.other_type || "rate";

        // Use default_valuation_source: default_cost uses template rate; system_valuation uses WIP
        const fallbackProduct =
          product ||
          (cost.unit_cost != null && cost.unit_cost !== ""
            ? {
                unit_cost: cost.unit_cost,
                cost_price: cost.unit_cost,
              }
            : null);

        const recipeQty = getSharedCostRecipeQty(cost);
        const loadedActualQty =
          cost.actual_qty ?? cost.actualQty ?? cost.actualQuantity ?? "";

        return {
          id: Date.now() + index,
          type: cost.type || "raw_material",
          product: product,
          availableQty: matchedInWip ? getRmAvailableQty(product) : 0,
          isOutOfWipStock:
            (cost.type || "raw_material") === "raw_material" && !matchedInWip,
          description: cost.description || cost.rawMaterialName || product?.item_name || "",
          descriptionCode: cost.descriptionCode || "",
          account_code: cost.accountHead || "",
          accountHead: cost.accountHead || "",
          rawMaterialId: cost.rawMaterialId || product?.product_id || product?.id || "",
          rawMaterialName: cost.rawMaterialName || product?.item_name || product?.name || "",
          rawMaterialSku: cost.rawMaterialSku || product?.item_code || product?.sku || "",
          quantity: recipeQty,
          expectedQuantity: recipeQty,
          actualQty: loadedActualQty,
          isActualQtyManuallySet:
            cost.isActualQtyManuallySet ??
            cost.is_actual_qty_manually_set ??
            Boolean(
              loadedActualQty != null && String(loadedActualQty).trim() !== "",
            ),
          unit_cost: getSharedCostUnitCost(
            cost.rate ?? cost.rate_amount,
            fallbackProduct,
          ),
          other_type: otherType,
          rate: cost.rate || "",
          percentage_basis:
            (cost.percentageBasis || cost.percentage_basis) === "raw_material"
              ? "all_items"
              : cost.percentageBasis || cost.percentage_basis || "all_items",
          isFromTemplate: true,
          isSharedCost: true,
        };
      });

      // Set shared costs state for display in the UI
      console.log(
        "Setting sharedCosts state with:",
        transformedSharedCosts.length,
        "items",
      );
      // Use setTimeout to ensure state updates after modal is rendered
      setTimeout(() => {
        const initialized = initializeSharedCostActualQty(
          transformedSharedCosts,
        );
        const effectiveQtyUse =
          computeSharedCostScaleFromRawMaterials(initialized) ?? qtyUseValue;
        setSharedCostQtyUse(effectiveQtyUse);
        const totalMult = computeTotalMultiplierFromItems(finalProductionItems);
          if (totalMult > 0) {
            setSharedCostOutputPercentage(
              parseFloat(totalMult.toFixed(4)),
            );
          }
          const expectedYield =
            parseTemplateExpectedYieldFromData(parsedData);
          if (expectedYield != null) {
            setSharedCostExpectedYieldPercent(expectedYield);
          }
          const costsWithAmounts = calculateSharedCostAmounts(
            initialized,
            effectiveQtyUse,
            parseJournalStyleAmount,
          );
          setSharedCosts(costsWithAmounts);
          console.log(
            "Loaded shared costs for joint_shared:",
            transformedSharedCosts,
          );

        const sharedCostLines = costsWithAmounts.filter(
          (cost) => cost.type !== "raw_material",
        );
        if (sharedCostLines.length > 0) {
          setOtherCostLines(sharedCostLines);
        }
      }, 100);
    } else if (isJointShared) {
      // Fallback: try to get from record.sharedCostingData if not in parsed data
      let sharedCostingData = record.sharedCostingData;

      if (typeof sharedCostingData === "string") {
        try {
          sharedCostingData = JSON.parse(sharedCostingData);
        } catch (e) {
          console.error("Error parsing sharedCostingData:", e);
          sharedCostingData = null;
        }
      }

      if (
        sharedCostingData &&
        sharedCostingData.sharedCosts &&
        Array.isArray(sharedCostingData.sharedCosts)
      ) {
        // Transform all shared costs (including raw materials) for display
        const transformedSharedCosts = sharedCostingData.sharedCosts.map(
          (cost, index) => {
            let product = null;
            let matchedInWip = false;
            if ((cost.type || "raw_material") === "raw_material") {
              const resolved = resolveLiveWipProductForSharedCost(
                cost,
                rawMaterialProducts,
              );
              product = resolved.product;
              matchedInWip = resolved.matchedInWip;
            }

            const otherType =
              cost.inputType || cost.otherType || cost.other_type || "rate";

            const fallbackProduct =
              product ||
              (cost.unit_cost != null && cost.unit_cost !== ""
                ? {
                    unit_cost: cost.unit_cost,
                    cost_price: cost.unit_cost,
                  }
                : null);

            const recipeQty = getSharedCostRecipeQty(cost);
            const loadedActualQty =
              cost.actual_qty ?? cost.actualQty ?? cost.actualQuantity ?? "";

            return {
              id: Date.now() + index,
              type: cost.type || "raw_material",
              product: product,
              availableQty: matchedInWip ? getRmAvailableQty(product) : 0,
              isOutOfWipStock:
                (cost.type || "raw_material") === "raw_material" &&
                !matchedInWip,
              description:
                cost.description ||
                cost.rawMaterialName ||
                product?.item_name ||
                "",
              descriptionCode: cost.descriptionCode || "",
              account_code: cost.accountHead || "",
              accountHead: cost.accountHead || "",
              rawMaterialId:
                cost.rawMaterialId || product?.product_id || product?.id || "",
              rawMaterialName:
                cost.rawMaterialName ||
                product?.item_name ||
                product?.name ||
                "",
              rawMaterialSku:
                cost.rawMaterialSku ||
                product?.item_code ||
                product?.sku ||
                "",
              quantity: recipeQty,
              expectedQuantity: recipeQty,
              actualQty: loadedActualQty,
              isActualQtyManuallySet:
                cost.isActualQtyManuallySet ??
                cost.is_actual_qty_manually_set ??
                Boolean(
                  loadedActualQty != null &&
                  String(loadedActualQty).trim() !== "",
                ),
              unit_cost: getSharedCostUnitCost(
                cost.rate ?? cost.rate_amount,
                fallbackProduct,
              ),
              other_type: otherType,
              rate: cost.rate || "",
              percentage_basis:
                (cost.percentageBasis || cost.percentage_basis) ===
                "raw_material"
                  ? "all_items"
                  : cost.percentageBasis ||
                    cost.percentage_basis ||
                    "all_items",
              isFromTemplate: true,
              isSharedCost: true,
            };
          },
        );

        const initialized = initializeSharedCostActualQty(
          transformedSharedCosts,
        );
        const effectiveQtyUse =
          computeSharedCostScaleFromRawMaterials(initialized) ?? qtyUseValue;
        setSharedCostQtyUse(effectiveQtyUse);
        const totalMult = computeTotalMultiplierFromItems(finalProductionItems);
          if (totalMult > 0) {
            setSharedCostOutputPercentage(
              parseFloat(totalMult.toFixed(4)),
            );
          }
          const expectedYield =
            parseTemplateExpectedYieldFromData(sharedCostingData);
          if (expectedYield != null) {
            setSharedCostExpectedYieldPercent(expectedYield);
          }
          const costsWithAmounts = calculateSharedCostAmounts(
            initialized,
            effectiveQtyUse,
            parseJournalStyleAmount,
          );
          setSharedCosts(costsWithAmounts);

          const sharedCostLines = costsWithAmounts.filter(
          (cost) => cost.type !== "raw_material",
        );
        if (sharedCostLines.length > 0) {
          setOtherCostLines(sharedCostLines);
          console.log("Loaded shared costs for joint_shared:", sharedCostLines);
        }
      }
    }

    // Final check: if still no shared costs but it's joint_shared, log for debugging
    if (isJointShared && sharedCostsData.length === 0) {
      console.warn(
        "Joint/Shared record but no sharedCosts found. Record:",
        record.id,
        "Record data:",
        record.data,
      );
    }
  };

  useEffect(() => {
    if (!costingRecordId || !activeBusiness?.id) return;
    setActiveTab("costing");
    if (
      selectedRecord &&
      String(selectedRecord.id) === String(costingRecordId) &&
      recordDetails?.productionItems?.length
    ) {
      return;
    }
    const stateRecord = location.state?.productionRecord;
    if (stateRecord && String(stateRecord.id) === String(costingRecordId)) {
      loadProductionCostingRecord(stateRecord);
      return;
    }
    if (productionRecords.length === 0) {
      getProductionRecords();
      return;
    }
    const fromList = productionRecords.find(
      (r) =>
        String(r.id) === String(costingRecordId) ||
        String(r.batch_id || "") === String(costingRecordId) ||
        String(r.batch_no || "") === String(costingRecordId),
    );
    if (fromList) {
      loadProductionCostingRecord(fromList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProductionCostingRecord is stable for a given record payload
  }, [
    costingRecordId,
    activeBusiness?.id,
    location.state,
    productionRecords,
    selectedRecord,
    recordDetails,
    getProductionRecords,
  ]);

  // Fields for costing tab
  const costingFields = [
    {
      title: <span className="text-[10px] tracking-wide">REF DETAILS</span>,
      custom: true,
      component: (record) => (
        <div className="text-left">
          <div className="font-medium text-blue-600">
            {record.batch_id || record.batch_no || record.id}
          </div>
          <div className="font-medium text-slate-700 text-[10px] break-all">
            {record.id || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Production Date",
      custom: true,
      component: (record) => (
        <div className="text-center">
          {moment(record.production_date).format("DD-MM-YYYY")}
        </div>
      ),
    },
    {
      value: "costing_type",
      title: "Type",
      custom: true,
      className: "text-center",
      component: (item) => {
        const costingType = item.costing_type || item.type;
        return (
          <div className="text-sm text-center">
            <Badge
              variant={item.type === "job_specific" ? "default" : "outline"}
              className={
                item.type === "job_specific"
                  ? "bg-gray-500 text-white border-green-600"
                  : "bg-[var(--aa-navy)] text-white border-green-600"
              }
            >
              {costingType === "joint_shared"
                ? "Joint / Shared"
                : costingType === "job_specific"
                  ? "Job / Specific"
                  : costingType || "N/A"}
            </Badge>
          </div>
        );
      },
    },
    {
      title: "Status",
      custom: true,
      component: (record) => (
        <div className="text-center">
          <Badge
            variant={record.status === "completed" ? "default" : "outline"}
            className={
              record.status === "completed"
                ? "bg-green-500 text-white border-green-600"
                : ""
            }
          >
            {record.status
              ? record.status.charAt(0).toUpperCase() + record.status.slice(1)
              : "Pending"}
          </Badge>
        </div>
      ),
    },
    {
      title: "Action",
      custom: true,
      component: (record) => (
        <div className="text-center flex items-center justify-center gap-2">
          <UIButton
            variant="outline"
            size="sm"
            onClick={() => {
              loadProductionCostingRecord(record);
              navigate(
                `/app/sales/markup/costing/${encodeURIComponent(record.id)}`,
                { state: { productionRecord: record } },
              );
            }}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            View Details
          </UIButton>
          {String(record.status || "").toLowerCase() !== "completed" &&
            String(record.status || "").toLowerCase() !== "rejected" && (
              <UIButton
                variant="outline"
                size="sm"
                onClick={() => openRejectCostingModal(record)}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                disabled={loadingRecords || rejectingRecord}
              >
                <Ban className="h-3 w-3 mr-1" />
                Reject
              </UIButton>
            )}
        </div>
      ),
    },
  ];

  return (
    <>
      {!isCostingDetailPage && (
        <div className="min-h-screen">
          <div className="max-w-7xl mx-auto">
            <div className="">
              <div className="p-">
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Manage Costing & Pricing
                  </h1>
                  <div className="flex items-center gap-4">
                    {/* Add item dropdown - only for manufacturing businesses */}
                    {(activeBusiness?.business_type || "")
                      .split(",")
                      .map((type) => type.trim().toLowerCase())
                      .includes("manufacturing") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <UIButton className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                            <ChevronDown className="h-4 w-4 ml-2" />
                          </UIButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() =>
                              handleOpenProductEntryModal("By-Product")
                            }
                          >
                            Add By-Product
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleOpenProductEntryModal("Finished Good")
                            }
                          >
                            Add Finished Good
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <span className="text-sm text-gray-600">
                      Total Items:{" "}
                      <span className="font-semibold text-gray-900">
                        {activeTab === "markup"
                          ? markupItems.length
                          : priceEditItems.length}
                      </span>
                    </span>
                    <span className="text-sm text-gray-600">
                      Active:{" "}
                      <span className="font-semibold text-green-600">
                        {
                          (activeTab === "markup"
                            ? markupItems
                            : priceEditItems
                          ).filter(
                            (item) =>
                              item.status === "Active" &&
                              item.activation !== "deactivated",
                          ).length
                        }
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search items by name..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {(activeBusiness?.business_type || "")
                .split(",")
                .map((type) => type.trim().toLowerCase())
                .includes("manufacturing") && (
                <ProductionProductEntryHistory
                  refreshKey={productionEntryHistoryRefresh}
                />
              )}

              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger
                    value="costing"
                    className="flex items-center gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    Costing
                  </TabsTrigger>
                  <TabsTrigger
                    value="price-edit"
                    className="flex items-center gap-2"
                  >
                    <DollarSign className="h-4 w-4" />
                    Direct Price Edit
                  </TabsTrigger>
                  <TabsTrigger
                    value="markup"
                    className="flex items-center gap-2"
                  >
                    <Tag className="h-4 w-4" />
                    Markup Management
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="markup" className="mt-6">
                  <div className="overflow-x-auto">
                    <CustomTable1
                      data={filteredMarkupData}
                      fields={fields}
                      message="No items found"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="price-edit" className="mt-6">
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FaInfoCircle className="text-blue-500" />
                      <p className="text-sm text-blue-700">
                        <strong>Direct Price Editing:</strong> Click the
                        &quot;Edit&quot; button to directly edit the selling
                        price for items. Only the selling price can be modified.
                        Cost price, markup, and markup type remain unchanged.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <CustomTable1
                      data={filteredPriceEditData}
                      fields={priceEditFields}
                      message="No items found"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="costing" className="mt-6">
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FaInfoCircle className="text-blue-500" />
                      <p className="text-sm text-blue-700">
                        <strong>Production Costing:</strong> View production
                        records, review finished goods and raw materials, add
                        other costs, and calculate total production costs.
                        Complete batches to transfer costs from WIP to Finished
                        Goods.
                      </p>
                    </div>
                  </div>
                  {loadingRecords ? (
                    <div className="text-center py-8">
                      Loading production records...
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <CustomTable1
                        data={productionRecords}
                        fields={costingFields}
                        message="No production records found"
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      <EditItemDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedItem={selectedItem}
        onSave={handleSaveChanges}
      />

      {rejectConfirmRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 text-white p-5 flex-shrink-0">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Ban className="h-5 w-5" />
                    Reject{" "}
                    {rejectConfirmRecord.batch_id ||
                      rejectConfirmRecord.batch_no ||
                      rejectConfirmRecord.id ||
                      "batch"}
                    ?
                  </h3>
                  <p className="text-red-100 text-sm mt-1">
                    Confirm removal from Costing
                  </p>
                </div>
                <button
                  type="button"
                  disabled={rejectingRecord}
                  onClick={() => setRejectConfirmRecord(null)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                This batch will be removed from Costing and will not appear on
                production reports. This action cannot be undone from this list.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <UIButton
                variant="outline"
                disabled={rejectingRecord}
                onClick={() => setRejectConfirmRecord(null)}
              >
                Cancel
              </UIButton>
              <UIButton
                disabled={rejectingRecord}
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={confirmRejectCostingRecord}
              >
                {rejectingRecord ? "Rejecting..." : "Reject"}
              </UIButton>
            </div>
          </div>
        </div>
      )}

      {/* By-Product Modal - Only for Manufacturing businesses */}
      {isByProductModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[var(--aa-navy)] text-white p-5 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Add {entryProductType} Entry
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    Create inventory entry for{" "}
                    {entryProductType === "Finished Good"
                      ? "finished goods"
                      : "by-products"}{" "}
                    from production
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsByProductModalOpen(false);
                    resetEntryModalState();
                  }}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select {entryProductType} *
                </label>
                <Typeahead
                  id="by-product-selector"
                  options={byProductsList}
                  labelKey={(option) =>
                    `${option.item_name} (${option.sku || option.item_code})`
                  }
                  placeholder={`Search and select a ${
                    entryProductType === "Finished Good"
                      ? "finished good"
                      : "by-product"
                  }...`}
                  onChange={(selected) => {
                    if (selected.length > 0) {
                      setSelectedByProduct(selected[0]);
                      // Pre-fill cost price if available
                      if (selected[0].cost_price) {
                        setByProductForm((prev) => ({
                          ...prev,
                          cost_price: selected[0].cost_price.toString(),
                        }));
                      }
                    } else {
                      setSelectedByProduct(null);
                    }
                  }}
                  selected={selectedByProduct ? [selectedByProduct] : []}
                  clearButton
                  className="rounded-lg"
                  inputProps={{
                    className:
                      "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]",
                  }}
                />
                {selectedByProduct && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-800">
                        {selectedByProduct.item_name}
                      </span>
                      <Badge
                        variant={
                          isProductTaxable(selectedByProduct.taxable)
                            ? "default"
                            : "outline"
                        }
                        className={
                          isProductTaxable(selectedByProduct.taxable)
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : ""
                        }
                      >
                        {selectedByProduct.taxable}
                      </Badge>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      SKU:{" "}
                      {selectedByProduct.sku || selectedByProduct.item_code} |
                      Unit: {selectedByProduct.unit_of_measure || "pcs"}
                    </p>
                  </div>
                )}
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Warehouse *
                </label>
                <select
                  value={targetBranch || ""}
                  onChange={(e) =>
                    setTargetBranch(
                      e.target.value ? parseInt(e.target.value, 10) : 0,
                    )
                  }
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] bg-white"
                >
                  <option value="">Select warehouse</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b.storeName || b.branch_name || b.branch_id) +
                        (isDefaultBranchRow(b) ? " (Default)" : "")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {entryProductType === "Finished Good"
                    ? "Cost of Production Account *"
                    : "Credit Account (Chart of Accounts) *"}
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  {entryProductType === "Finished Good"
                    ? "Chart of accounts head credited when finished goods are received into inventory."
                    : "Chart of accounts head credited when by-product is received (e.g. WIP). Defaults to facility WIP when configured."}
                </p>
                  {selectedProductionAccount ? (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-500 shrink-0">
                        {selectedProductionAccount.head}
                      </span>
                      <span className="flex-1 text-gray-800 truncate">
                        {selectedProductionAccount.description}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProductionAccount(null);
                          setProductionAccountSearch("");
                        }}
                        className="ml-1 text-gray-400 hover:text-red-500 font-bold shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        value={productionAccountSearch}
                        onChange={(e) => {
                          setProductionAccountSearch(e.target.value);
                          setProductionAccountOpen(true);
                        }}
                        onFocus={() => setProductionAccountOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setProductionAccountOpen(false), 150)
                        }
                        placeholder={
                          productionAccountsLoading
                            ? "Loading chart of accounts..."
                            : "Search account code or name..."
                        }
                        disabled={
                          productionAccountsLoading || byProductSubmitting
                        }
                        autoComplete="off"
                        className="w-full"
                      />
                      {productionAccountOpen && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-y-auto">
                          {productionAccounts
                            .filter((acc) => {
                              if (!productionAccountSearch) return true;
                              const term =
                                productionAccountSearch.toLowerCase();
                              return (
                                String(acc.head || "")
                                  .toLowerCase()
                                  .includes(term) ||
                                String(acc.description || "")
                                  .toLowerCase()
                                  .includes(term)
                              );
                            })
                            .slice(0, 60)
                            .map((acc, idx) => (
                              <div
                                key={`${acc.head}-${idx}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelectedProductionAccount(acc);
                                  setProductionAccountSearch("");
                                  setProductionAccountOpen(false);
                                }}
                                className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-0"
                              >
                                <span className="font-mono text-xs text-gray-500 mr-2">
                                  {acc.head}
                                </span>
                                <span className="text-gray-800">
                                  {acc.description}
                                </span>
                              </div>
                            ))}
                          {!productionAccountsLoading &&
                            productionAccounts.filter((acc) => {
                              if (!productionAccountSearch) return true;
                              const term =
                                productionAccountSearch.toLowerCase();
                              return (
                                String(acc.head || "")
                                  .toLowerCase()
                                  .includes(term) ||
                                String(acc.description || "")
                                  .toLowerCase()
                                  .includes(term)
                              );
                            }).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500">
                                No matching accounts
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity *
                </label>
                <Input
                  type="number"
                  placeholder="Enter quantity"
                  value={byProductForm.quantity}
                  onChange={(e) =>
                    setByProductForm((prev) => ({
                      ...prev,
                      quantity: e.target.value,
                    }))
                  }
                  className="w-full"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Cost Price */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cost Price (₦) *
                </label>
                <Input
                  type="number"
                  placeholder="Enter cost price"
                  value={byProductForm.cost_price}
                  onChange={(e) =>
                    setByProductForm((prev) => ({
                      ...prev,
                      cost_price: e.target.value,
                    }))
                  }
                  className="w-full"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Markup Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Markup Type
                  </label>
                  <select
                    value={byProductForm.markup_mode}
                    onChange={(e) =>
                      setByProductForm((prev) => ({
                        ...prev,
                        markup_mode: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Markup Value
                  </label>
                  <Input
                    type="number"
                    placeholder={
                      byProductForm.markup_mode === "percentage"
                        ? "e.g., 20"
                        : "e.g., 500"
                    }
                    value={byProductForm.mark_up}
                    onChange={(e) =>
                      setByProductForm((prev) => ({
                        ...prev,
                        mark_up: e.target.value,
                      }))
                    }
                    className="w-full"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* VAT Rate Input - Only show for taxable items when VAT should be applied */}
              {shouldApplyVatOnMarkupPrice(selectedByProduct?.taxable) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    VAT Rate (%) *
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      placeholder="Enter VAT rate (e.g., 7.5)"
                      value={byProductForm.vat_rate}
                      onChange={(e) =>
                        setByProductForm((prev) => ({
                          ...prev,
                          vat_rate: e.target.value,
                        }))
                      }
                      className="w-full"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <div className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                      <FaInfoCircle className="text-blue-500" />
                      <span>Will be added to selling price</span>
                    </div>
                  </div>
                </div>
              )}

              {/* GL Preview (always at production cost) */}
              {byProductForm.cost_price &&
                byProductForm.quantity &&
                calculateEntryGlAmount() > 0 && (
                  <Collapsible
                    open={glJournalPreviewOpen}
                    onOpenChange={setGlJournalPreviewOpen}
                  >
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-indigo-100/60 transition-colors rounded-lg"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {glJournalPreviewOpen ? (
                              <ChevronDown
                                className="h-4 w-4 text-indigo-700 shrink-0"
                              />
                            ) : (
                              <ChevronRight
                                className="h-4 w-4 text-indigo-500 shrink-0"
                              />
                            )}
                            <span className="text-sm font-semibold text-indigo-900">
                              Journal entries (at cost)
                            </span>
                            {!glJournalPreviewOpen && (
                              <span className="text-xs font-semibold text-indigo-800 truncate">
                                — ₦{formatNumber(calculateEntryGlAmount())}
                              </span>
                            )}
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 border-t border-indigo-200/60">
                          <p className="text-xs text-indigo-700 mb-3 pt-3">
                            GL postings use quantity × unit cost only — not
                            selling price or markup.
                          </p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-700">
                                DR{" "}
                                {selectedByProduct?.inventory_account ||
                                  "Inventory account"}
                              </span>
                              <span className="font-semibold text-indigo-900">
                                ₦{formatNumber(calculateEntryGlAmount())}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-gray-700">
                                CR{" "}
                                {selectedProductionAccount?.head ||
                                  "Credit account"}
                              </span>
                              <span className="font-semibold text-indigo-900">
                                ₦{formatNumber(calculateEntryGlAmount())}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

              {/* Price Preview */}
              {byProductForm.cost_price && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Selling price preview
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cost Price:</span>
                      <span className="font-medium">
                        ₦
                        {formatNumber(
                          parseFloat(byProductForm.cost_price) || 0,
                        )}
                      </span>
                    </div>
                    {byProductForm.mark_up && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          Markup (
                          {byProductForm.markup_mode === "percentage"
                            ? `${byProductForm.mark_up}%`
                            : `₦${byProductForm.mark_up}`}
                          ):
                        </span>
                        <span className="font-medium text-green-600">
                          +₦
                          {formatNumber(
                            byProductForm.markup_mode === "percentage"
                              ? ((parseFloat(byProductForm.cost_price) || 0) *
                                  (parseFloat(byProductForm.mark_up) || 0)) /
                                  100
                              : parseFloat(byProductForm.mark_up) || 0,
                          )}
                        </span>
                      </div>
                    )}
                    {shouldApplyVatOnMarkupPrice(selectedByProduct?.taxable) &&
                      byProductForm.vat_rate && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            VAT ({byProductForm.vat_rate}%):
                          </span>
                          <span className="font-medium text-amber-600">
                            +₦
                            {formatNumber(
                              (() => {
                                const costPrice =
                                  parseFloat(byProductForm.cost_price) || 0;
                                const markup =
                                  parseFloat(byProductForm.mark_up) || 0;
                                let priceBeforeVat = costPrice;

                                if (
                                  byProductForm.markup_mode === "percentage"
                                ) {
                                  priceBeforeVat =
                                    costPrice + (costPrice * markup) / 100;
                                } else {
                                  priceBeforeVat = costPrice + markup;
                                }

                                const vatRate =
                                  parseFloat(byProductForm.vat_rate) || 0;
                                const vatAmount =
                                  priceBeforeVat * (vatRate / 100);
                                return vatAmount.toFixed(2);
                              })(),
                            )}
                          </span>
                        </div>
                      )}
                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between text-base">
                        <span className="font-semibold text-gray-700">
                          Selling Price:
                        </span>
                        <span className="font-bold text-blue-600">
                          ₦
                          {formatNumber(
                            calculateByProductSellingPrice().toFixed(2),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
              <UIButton
                variant="outline"
                onClick={() => {
                  setIsByProductModalOpen(false);
                  resetEntryModalState();
                }}
              >
                Cancel
              </UIButton>
              <UIButton
                onClick={handleByProductSubmit}
                disabled={
                  byProductSubmitting ||
                  !selectedByProduct ||
                  !targetBranch ||
                  !byProductForm.quantity ||
                  !byProductForm.cost_price ||
                  !selectedProductionAccount ||
                  (shouldApplyVatOnMarkupPrice(selectedByProduct?.taxable) &&
                    (!byProductForm.vat_rate ||
                      parseFloat(byProductForm.vat_rate) <= 0))
                }
                className="bg-[var(--aa-navy)] hover:bg-[var(--aa-navy-hover)] text-white"
              >
                {byProductSubmitting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create {entryProductType} Entry
                  </>
                )}
              </UIButton>
            </div>
          </div>
        </div>
      )}

      {/* Production costing detail page */}
      {isCostingDetailPage && !selectedRecord && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-gray-600">
          <span className="animate-spin text-2xl mb-3">⏳</span>
          <p>Loading production batch…</p>
        </div>
      )}
      {isCostingDetailPage && selectedRecord && (
        <div className="bg-gray-50 pb-6 min-w-0 w-full max-w-full overflow-x-hidden">
          <div className="bg-[var(--aa-navy)] text-white px-4 py-4 shadow-md shrink-0">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <SidebarTrigger className="text-white hover:bg-white/20 shrink-0 mt-0.5" />
                <button
                  type="button"
                  onClick={handleCloseDetailsModal}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all shrink-0"
                  aria-label="Back to costing list"
                >
                  <ArrowLeft size={22} />
                </button>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold truncate">
                    Production Costing — {getSelectedBatchNo()}
                  </h1>
                  <p className="text-blue-100 text-sm mt-0.5">
                    Manage overhead costs and complete production batch
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-blue-100 text-sm font-semibold whitespace-nowrap">
                    Production Date:
                  </span>
                  <input
                    type="date"
                    value={productionDateInput}
                    onChange={(e) => setProductionDateInput(e.target.value)}
                    className="px-2 py-1 rounded-md border border-blue-200 bg-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {ingredientVarianceScan.hasReasonRequired && (
            <div className="bg-amber-500 text-white px-4 py-2.5 shadow-md">
              <div className="max-w-[1600px] mx-auto flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">
                  Material usage is above 5% vs expected — a written reason is
                  required before Complete Batch.
                </p>
                <button
                  type="button"
                  onClick={scrollToIngredientVarianceReason}
                  className="shrink-0 text-sm font-semibold underline underline-offset-2 hover:text-amber-100 text-left sm:text-right"
                >
                  Go to reason field ↓
                </button>
              </div>
            </div>
          )}

          <div className="p-4 max-w-[1600px] w-full mx-auto min-w-0">
            {/* Shared Costs Section - Only for joint_shared type */}
            {isJointSharedCostingRecord(selectedRecord) && (
              <>
                <div className="mb-6 bg-white rounded-lg border border-purple-200 shadow-sm min-w-0 overflow-hidden">
                  {/* Shared Costs Header */}
                  {/* {JSON.stringify(recordDetails)} */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-3 border-b border-purple-200 rounded-t-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Package className="text-purple-600 w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">
                            Shared Costs{" "}
                            <span className="text-purple-600">
                              (Joint/Shared)
                            </span>
                            {" · "}
                            <span className="text-orange-600">
                              Template By-Product
                            </span>
                          </h4>
                          <p className="text-sm text-gray-600">
                            Shared costs across all products, plus by-product
                            template lines from costing
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700">
                        {sharedCosts.length} item(s)
                      </Badge>
                    </div>
                  </div>
                  {/* Shared Costs Content */}
                  <div className="">
                    <div className="flex justify-between items-center  p-2 ">
                      <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide   ">
                        Cost Breakdown (Shared)
                      </h5>
                      <div className="flex items-center gap-3">
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center gap-1.5 h-8">
                            <label
                              htmlFor="shared-cost-qty-used"
                              className="text-xs font-medium text-gray-700 whitespace-nowrap leading-none mb-0"
                            >
                              Scale factor
                            </label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex text-gray-400 hover:text-purple-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 rounded"
                                  aria-label="About scale factor for production costing"
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
                                  Total actual raw material qty ÷ total recipe
                                  qty. Scales other shared costs (rates). Raw
                                  material cost uses actual qty per line.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Input
                              id="shared-cost-qty-used"
                              type="number"
                              value={sharedCostQtyUse}
                              readOnly
                              disabled
                              min="0"
                              step="0.0001"
                              className="min-w-[7.5rem] w-32 h-8 text-sm text-center px-2 tabular-nums bg-gray-50 text-gray-600 cursor-not-allowed"
                              placeholder="1"
                              aria-label="Scale factor from actual raw material usage (read only)"
                            />
                          </div>
                        </TooltipProvider>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <UIButton
                              size="sm"
                              className="text-xs bg-purple-600 text-white hover:bg-purple-700"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Line
                              <ChevronDown className="h-3 w-3 ml-1" />
                            </UIButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() =>
                                handleAddSharedCost("raw_material")
                              }
                              className="cursor-pointer"
                            >
                              <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                              Raw Material
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() =>
                                handleAddSharedCost("by_product_credit")
                              }
                              className="cursor-pointer"
                            >
                              <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                              By-product credit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleAddSharedCost("other")}
                              className="cursor-pointer"
                            >
                              <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                              Other
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Shared Costs Table */}
                    <div className="overflow-x-auto max-w-full min-w-0">
                      <table className="w-full table-fixed divide-y divide-gray-200">
                        <colgroup>
                          <col className="w-[6%]" />
                          <col className="w-[24%]" />
                          <col className="w-[14%]" />
                          <col className="w-[6%]" />
                          <col className="w-[12%]" />
                          <col className="w-[14%]" />
                          <col className="w-[12%]" />
                          <col className="w-[4%]" />
                        </colgroup>
                        <thead className="bg-purple-50">
                          <tr>
                            <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                              Type
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                              Account / Product
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                              Description
                            </th>
                            <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                              Input
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                              Rate / Basis
                            </th>
                            <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase leading-tight">
                              Expected / Actual / Available
                            </th>
                            <th className="px-2 py-2 text-right text-xs font-bold text-gray-700 uppercase">
                              Amount (₦)
                            </th>
                            <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sharedCosts.length === 0 ? (
                            <tr>
                              <td
                                colSpan={8}
                                className="px-4 py-8 text-center text-gray-500"
                              >
                                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                <p>
                                  No shared costs added yet. Click &quot;Add
                                  Line&quot; to add costs.
                                </p>
                              </td>
                            </tr>
                          ) : (
                            (() => {
                              const rawMaterialsTotal =
                                sumSharedActualRawMaterialsTotal(
                                  sharedCosts,
                                  sharedCostQtyUse,
                                  parseJournalStyleAmount,
                                );

                              const getItemAmount = (item, runningTotal) =>
                                computeSharedCostLineAmount(
                                  item,
                                  {
                                    runningTotal,
                                    rawMaterialsTotal,
                                    qtyUse: sharedCostQtyUse,
                                  },
                                  parseJournalStyleAmount,
                                );

                              // Pre-calculate running totals for each item
                              const itemRunningTotals = {};
                              let runningTotal = rawMaterialsTotal;

                              sharedCosts.forEach((item) => {
                                const itemType = item.type || "raw_material";
                                // Store the running total BEFORE this item
                                itemRunningTotals[item.id] = runningTotal;

                                // Calculate this item's amount
                                const amt = getItemAmount(item, runningTotal);

                                // Update running total based on item type
                                if (isMaterialType(itemType)) {
                                  // Raw materials are already in rawMaterialsTotal, don't add again
                                } else if (itemType === "by_product_credit") {
                                  runningTotal -= amt;
                                } else {
                                  runningTotal += amt;
                                }
                              });

                              return sharedCosts.map((cost) => {
                                const costType = cost.type || "raw_material";
                                const inputType = cost.other_type || "rate";
                                const currentRunningTotal =
                                  itemRunningTotals[cost.id] ||
                                  rawMaterialsTotal;

                                // Calculate amount based on type
                                const calculatedAmount = getItemAmount(
                                  cost,
                                  currentRunningTotal,
                                );

                                const resolvedWip = isMaterialType(costType)
                                  ? resolveLiveWipProductForSharedCost(
                                      cost,
                                      rawMaterialProducts,
                                    )
                                  : { product: null, matchedInWip: false };
                                const displayProduct =
                                  resolvedWip.product ||
                                  cost.product ||
                                  (isMaterialType(costType)
                                    ? buildSharedCostStubProduct(cost)
                                    : null);
                                const matchedInWip = Boolean(
                                  resolvedWip.matchedInWip,
                                );
                                const isOutOfWipStock =
                                  isMaterialType(costType) &&
                                  Boolean(
                                    cost.isOutOfWipStock ||
                                      (displayProduct && !matchedInWip),
                                  );
                                const availableQty = matchedInWip
                                  ? getRmAvailableQty(resolvedWip.product)
                                  : 0;
                                const qtyUsed = isMaterialType(costType)
                                  ? getSharedCostActualTotal(
                                      cost,
                                      sharedCostQtyUse,
                                    )
                                  : 0;
                                const isInsufficient =
                                  isMaterialType(costType) &&
                                  matchedInWip &&
                                  qtyUsed > availableQty;
                                const uom =
                                  displayProduct?.unit_of_measure ||
                                  displayProduct?.uom ||
                                  cost.product?.unit_of_measure ||
                                  cost.product?.uom ||
                                  "units";

                                return (
                                  <tr
                                    key={cost.id}
                                    className={
                                      isMaterialType(costType)
                                        ? isOutOfWipStock || isInsufficient
                                          ? "bg-red-50 hover:bg-red-100"
                                          : "bg-orange-50 hover:bg-orange-100"
                                        : costType === "by_product_credit"
                                          ? "bg-blue-50 hover:bg-blue-100"
                                          : "bg-gray-50 hover:bg-gray-100"
                                    }
                                  >
                                    {/* {JSON.stringify(cost)}MNNNMNM */}
                                    {/* Type */}
                                    <td className="px-1 py-2 align-top overflow-hidden">
                                      <select
                                        value={costType}
                                        onChange={(e) =>
                                          handleUpdateSharedCost(
                                            cost.id,
                                            "type",
                                            e.target.value,
                                          )
                                        }
                                        className={`text-xs border rounded px-1 py-0.5 font-medium w-full min-w-0 max-w-full h-9 ${
                                          isMaterialType(costType)
                                            ? "bg-orange-100 text-orange-700 border-orange-200"
                                            : costType === "by_product_credit"
                                              ? "bg-blue-100 text-blue-700 border-blue-200"
                                              : "bg-gray-100 text-gray-700 border-gray-200"
                                        }`}
                                      >
                                        <option value="raw_material">
                                          Raw Mat.
                                        </option>
                                        <option value="semi_finished">
                                          Semi Fin.
                                        </option>
                                        <option value="semi_finished">
                                          Semi Fin.
                                        </option>
                                        <option value="by_product_credit">
                                          By-prod.
                                        </option>
                                        <option value="other">Other</option>
                                      </select>
                                    </td>

                                    {/* Account / Product */}
                                    <td className="px-2 py-2 align-top overflow-hidden">
                                      {isMaterialType(costType) ? (
                                        <div className="min-w-0 w-full">
                                          <Typeahead
                                            id={`shared-cost-product-${cost.id}`}
                                            options={
                                              displayProduct &&
                                              !rawMaterialProducts.some(
                                                (rm) =>
                                                  String(rm.product_id || "") ===
                                                    String(
                                                      displayProduct.product_id ||
                                                        "",
                                                    ) ||
                                                  String(rm.item_code || "") ===
                                                    String(
                                                      displayProduct.item_code ||
                                                        "",
                                                    ) ||
                                                  String(rm.sku || "") ===
                                                    String(
                                                      displayProduct.sku || "",
                                                    ),
                                              )
                                                ? [
                                                    displayProduct,
                                                    ...rawMaterialProducts,
                                                  ]
                                                : rawMaterialProducts
                                            }
                                            labelKey={(product) =>
                                              `${
                                                product.item_name ||
                                                product.name ||
                                                "N/A"
                                              } (${
                                                product.item_code ||
                                                product.sku ||
                                                "N/A"
                                              })`
                                            }
                                            renderMenuItemChildren={(product) => (
                                              <div className="min-w-0">
                                                <div className="truncate">
                                                  {product.item_name ||
                                                    product.name ||
                                                    "N/A"}{" "}
                                                  (
                                                  {product.item_code ||
                                                    product.sku ||
                                                    "N/A"}
                                                  )
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  Avail:{" "}
                                                  {getRmAvailableQty(
                                                    product,
                                                  ).toFixed(4)}{" "}
                                                  {product.unit_of_measure ||
                                                    product.uom ||
                                                    "units"}
                                                </div>
                                              </div>
                                            )}
                                            placeholder={
                                              costType === "semi_finished"
                                                ? "Select semi finished..."
                                                : "Select raw material..."
                                            }
                                            onChange={(selected) => {
                                              handleUpdateSharedCost(
                                                cost.id,
                                                "product",
                                                selected && selected.length > 0
                                                  ? selected[0]
                                                  : null,
                                              );
                                            }}
                                            selected={
                                              displayProduct
                                                ? [displayProduct]
                                                : []
                                            }
                                            clearButton
                                            className="text-sm w-full min-w-0"
                                            inputProps={{
                                              className: "truncate",
                                            }}
                                          />
                                          {isMaterialType(costType) && (
                                            <p className="mt-1 text-xs text-gray-600">
                                              {isOutOfWipStock ? (
                                                <span className="text-red-700 font-semibold">
                                                  ⚠ Out of WIP Stock — not
                                                  available in Work in Progress
                                                </span>
                                              ) : isInsufficient ? (
                                                <span className="text-red-700 font-semibold">
                                                  ⚠ Qty used (
                                                  {formatSharedCostQtyDisplay(
                                                    qtyUsed,
                                                  )}
                                                  ) exceeds available (
                                                  {formatSharedCostQtyDisplay(
                                                    availableQty,
                                                  )}
                                                  )
                                                </span>
                                              ) : displayProduct ? (
                                                <>
                                                  Available:{" "}
                                                  <span className="font-bold text-green-600">
                                                    {formatSharedCostQtyDisplay(
                                                      availableQty,
                                                    )}
                                                  </span>{" "}
                                                  {uom}
                                                </>
                                              ) : (
                                                <span className="text-amber-700 font-semibold">
                                                  Select a raw material to see
                                                  available qty
                                                </span>
                                              )}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="min-w-0 w-full">
                                        <Typeahead
                                          id={`shared-cost-account-${cost.id}`}
                                          labelKey={(option) =>
                                            `${option.code} ${option.name}`
                                          }
                                          renderMenuItemChildren={(option) => (
                                            <div>
                                              <div>
                                                <strong>{option.code}</strong>{" "}
                                                {option.name}
                                              </div>
                                              {option.account_type && (
                                                <div className="text-xs text-gray-500">
                                                  Type: {option.account_type}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          options={expenseList || []}
                                          placeholder="Select account..."
                                          onChange={(selected) => {
                                            handleUpdateSharedCost(
                                              cost.id,
                                              "account",
                                              selected && selected.length > 0
                                                ? selected[0]
                                                : null,
                                            );
                                          }}
                                          selected={
                                            cost.descriptionCode
                                              ? expenseList.filter(
                                                  (e) =>
                                                    e.code ===
                                                    cost.descriptionCode,
                                                )
                                              : []
                                          }
                                          clearButton
                                          className="text-sm w-full min-w-0"
                                          inputProps={{
                                            className: "truncate",
                                          }}
                                        />
                                        </div>
                                      )}
                                    </td>

                                    {/* Description */}
                                    <td className="px-2 py-2 align-top overflow-hidden">
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
                                        className="text-sm w-full min-w-0"
                                      />
                                    </td>

                                    {/* Input Type */}
                                    <td className="px-1 py-2 align-top overflow-hidden">
                                      {costType === "raw_material" ? (
                                        <span className="inline-flex items-center h-9 text-xs text-gray-500">
                                          —
                                        </span>
                                      ) : (
                                        <select
                                          value={inputType}
                                          onChange={(e) =>
                                            handleUpdateSharedCost(
                                              cost.id,
                                              "other_type",
                                              e.target.value,
                                            )
                                          }
                                          className="text-xs border rounded px-1 py-0.5 w-full max-w-full min-w-0 h-9"
                                        >
                                          <option value="rate">Rate</option>
                                          <option value="percentage">%</option>
                                        </select>
                                      )}
                                    </td>

                                    {/* Rate / Basis */}
                                    <td className="px-2 py-2 align-top overflow-hidden">
                                      {costType === "raw_material" ? (
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={formatJournalStyleQtyInputDisplay(
                                            cost.unit_cost ?? "",
                                          )}
                                          onChange={(e) =>
                                            handleUpdateSharedCost(
                                              cost.id,
                                              "unit_cost",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="0.00"
                                          className="w-full min-w-0 text-right text-sm"
                                        />
                                      ) : inputType === "percentage" ? (
                                        <div className="flex flex-col gap-1 w-full min-w-0">
                                          <select
                                            value={
                                              cost.percentage_basis || "all_items"
                                            }
                                            onChange={(e) =>
                                              handleUpdateSharedCost(
                                                cost.id,
                                                "percentage_basis",
                                                e.target.value,
                                              )
                                            }
                                            className="text-xs border rounded px-1 py-0.5 w-full min-w-0 max-w-full h-9 truncate"
                                          >
                                            <option value="raw_material">
                                              Raw Mat.
                                            </option>
                                            <option value="all_items">
                                              All Above
                                            </option>
                                          </select>
                                          <Input
                                            type="text"
                                            inputMode="decimal"
                                            value={formatJournalStyleQtyInputDisplay(
                                              cost.quantity ?? "",
                                            )}
                                            onChange={(e) =>
                                              handleUpdateSharedCost(
                                                cost.id,
                                                "quantity",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="%"
                                            className="w-full min-w-0 max-w-full text-sm h-9"
                                          />
                                        </div>
                                      ) : (
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          value={formatJournalStyleQtyInputDisplay(
                                            cost.rate ?? "",
                                          )}
                                          onChange={(e) =>
                                            handleUpdateSharedCost(
                                              cost.id,
                                              "rate",
                                              e.target.value,
                                            )
                                          }
                                          placeholder="0.00"
                                          className="w-full min-w-0 text-right text-sm"
                                        />
                                      )}
                                    </td>

                                    {/* Expected / Actual Qty */}
                                    <td className="px-2 py-2 align-top overflow-hidden">
                                      <div className="flex flex-col gap-1.5 w-full min-w-0 text-xs leading-snug text-gray-600 pt-1.5">
                                        {isMaterialType(costType) ? (
                                          <>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Expected
                                              </span>
                                              <span className="font-bold text-gray-800 tabular-nums text-right">
                                                {formatSharedCostQtyDisplay(
                                                  getSharedCostRecipeQty(cost),
                                                )}
                                              </span>
                                              <span className="text-gray-500">
                                                {uom}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Actual
                                              </span>
                                              <span
                                                className={`font-bold tabular-nums text-right ${
                                                  isInsufficient
                                                    ? "text-red-700"
                                                    : "text-success"
                                                }`}
                                              >
                                                {formatSharedCostQtyDisplay(
                                                  getSharedCostActualTotal(
                                                    cost,
                                                    sharedCostQtyUse,
                                                  ),
                                                )}
                                              </span>
                                              <span className="text-gray-500">
                                                {uom}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Available
                                              </span>
                                              {isOutOfWipStock ? (
                                                <span className="font-bold text-red-700 text-right col-span-2">
                                                  Out of WIP Stock
                                                </span>
                                              ) : displayProduct ? (
                                                <>
                                                  <span
                                                    className={`font-bold tabular-nums text-right ${
                                                      availableQty > 0
                                                        ? "text-green-700"
                                                        : "text-red-600"
                                                    }`}
                                                  >
                                                    {formatSharedCostQtyDisplay(
                                                      availableQty,
                                                    )}
                                                  </span>
                                                  <span className="text-gray-500">
                                                    {uom}
                                                  </span>
                                                </>
                                              ) : (
                                                <span className="font-semibold text-amber-700 text-right col-span-2">
                                                  Select product
                                                </span>
                                              )}
                                            </div>
                                            {isOutOfWipStock && (
                                              <span className="text-[10px] text-red-600 font-semibold">
                                                ⚠ Not found in WIP inventory
                                              </span>
                                            )}
                                            {isInsufficient && (
                                              <span className="text-[10px] text-red-600 font-semibold">
                                                ⚠ Insufficient stock
                                              </span>
                                            )}
                                          </>
                                        ) : inputType === "percentage" ? (
                                          <>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Expected
                                              </span>
                                              <span className="font-bold text-gray-800 tabular-nums text-right">
                                                {cost.quantity != null &&
                                                String(cost.quantity).trim() !==
                                                  ""
                                                  ? `${cost.quantity}%`
                                                  : "—"}
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Actual
                                              </span>
                                              <span className="font-bold text-gray-400 tabular-nums text-right">
                                                —
                                              </span>
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Expected
                                              </span>
                                              <span className="font-bold text-gray-400 tabular-nums text-right">
                                                —
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                                              <span className="text-gray-500">
                                                Actual
                                              </span>
                                              <span className="font-bold text-gray-400 tabular-nums text-right">
                                                —
                                              </span>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-2 py-2 align-top overflow-hidden text-sm text-right font-semibold text-gray-700 pt-3">
                                      {costType === "by_product_credit" ? (
                                        <span className="text-blue-600">
                                          -
                                          {formatNumber(
                                            calculatedAmount.toFixed(2),
                                          )}
                                        </span>
                                      ) : (
                                        formatNumber(
                                          calculatedAmount.toFixed(2),
                                        )
                                      )}
                                    </td>

                                    {/* Action */}
                                    <td className="px-2 py-2 align-top overflow-hidden text-center pt-2.5">
                                      <button
                                        onClick={() =>
                                          handleRemoveSharedCost(cost.id)
                                        }
                                        className="inline-flex items-center justify-center text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              });
                            })()
                          )}

                          {sharedCosts.length > 0 && (
                            <tr className="bg-slate-50 font-semibold">
                              <td
                                colSpan={6}
                                className="px-2 py-2 text-right text-sm text-slate-800"
                              >
                                Per recipe unit (subtotal):
                              </td>
                              <td className="px-2 py-2 text-right text-sm text-slate-800 tabular-nums">
                                ₦
                                {formatNumber(
                                  sharedCostSummaryAmounts.perRecipeUnitSubtotal.toFixed(
                                    2,
                                  ),
                                )}
                              </td>
                              <td className="px-2 py-2"></td>
                            </tr>
                          )}

                          {templateHandlesByProduct &&
                            templateByProductCreditAmount > 0 && (
                              <tr className="bg-sky-50 font-semibold">
                                <td
                                  colSpan={6}
                                  className="px-2 py-2 text-right text-sm text-sky-900"
                                >
                                  By-Product/Scrap credit
                                  {(() => {
                                    const tbp =
                                      templateByProduct.selectedTemplateByProduct;
                                    const name =
                                      tbp?.item_name || tbp?.name || "";
                                    const code = String(
                                      tbp?.sku || tbp?.item_code || "",
                                    ).trim();
                                    const qty = Math.max(
                                      parseFloat(
                                        String(
                                          templateByProduct.templateByProductQty ||
                                            "",
                                        ).replace(/,/g, ""),
                                      ) || 1,
                                      1,
                                    );
                                    const unitCost =
                                      resolveTemplateByProductHeaderUnitCost(
                                        templateByProduct.templateByProductUnitCost,
                                        tbp,
                                      );
                                    return (
                                      <>
                                        {name || code ? " (" : ""}
                                        {name}
                                        {name && code ? " · " : ""}
                                        {code}
                                        {name || code ? ")" : ""}
                                        {" — "}
                                        {formatNumber(unitCost.toFixed(2))}
                                        {" × "}
                                        {formatNumber(qty.toFixed(2))}
                                      </>
                                    );
                                  })()}
                                  :
                                </td>
                                <td className="px-2 py-2 text-right text-sm text-sky-800 tabular-nums">
                                  <span className="text-blue-600 font-bold">
                                    -
                                    {formatNumber(
                                      templateByProductCreditAmount.toFixed(2),
                                    )}
                                  </span>
                                </td>
                                <td className="px-2 py-2"></td>
                              </tr>
                            )}

                          {/* Totals Row */}
                          {sharedCosts.length > 0 && (
                            <tr className="bg-indigo-100 font-bold">
                              <td
                                colSpan={6}
                                className="px-2 py-2 text-right text-sm text-indigo-800"
                              >
                                TOTAL SHARED COSTS PER UNIT:
                              </td>
                              <td className="px-2 py-2 text-right text-sm text-indigo-800 tabular-nums">
                                ₦
                                {formatNumber(
                                  sharedCostSummaryAmounts.totalSharedCostsPerUnit.toFixed(
                                    2,
                                  ),
                                )}
                              </td>
                              <td className="px-2 py-2"></td>
                            </tr>
                          )}
                          {sharedCosts.length > 0 && (
                            <tr className="bg-purple-100 font-bold">
                              <td
                                colSpan={6}
                                className="px-2 py-2 text-right text-sm text-purple-800"
                              >
                                TOTAL SHARED COSTS:
                              </td>
                              <td className="px-2 py-2 text-right text-sm text-purple-800 tabular-nums">
                                ₦
                                {formatNumber(
                                  sharedCostSummaryAmounts.totalSharedCosts.toFixed(
                                    2,
                                  ),
                                )}
                              </td>
                              <td className="px-2 py-2"></td>
                            </tr>
                          )}
                          {sharedCosts.length > 0 && (
                            <tr className="bg-green-100 font-bold">
                              <td colSpan={5} className="px-2 py-2"></td>
                              <td
                                colSpan={1}
                                className="px-2 py-2 text-center text-sm text-green-800"
                              >
                                {(() => {
                                  const yieldPct = getSharedCostYieldPercent();
                                  const expectedPct =
                                    getSharedCostExpectedYieldPercent();
                                  const varianceMeta =
                                    getSharedCostYieldVarianceMeta();
                                  const outputQty =
                                    parseFloat(sharedCostOutputPercentage) ||
                                    calculateTotalMultiplier() ||
                                    0;
                                  const rawMaterialQty =
                                    sumSharedActualRawMaterialsInputQty(
                                      sharedCosts,
                                      1,
                                    );
                                  const perUnit =
                                    sharedCostSummaryAmounts.totalSharedCostsPerUnit;
                                  const amount = getSharedCostOutputAmount();

                                  const yieldField = (
                                    label,
                                    value,
                                    ariaLabel,
                                    tooltipTitle,
                                    tooltipBody,
                                  ) => (
                                    <div className="flex flex-col items-stretch gap-0.5 min-w-[5.5rem] flex-1">
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-xs whitespace-nowrap">
                                          {label}
                                        </span>
                                        {tooltipTitle && (
                                          <TooltipProvider delayDuration={200}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  className="inline-flex text-green-600/70 hover:text-green-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 rounded"
                                                  aria-label={ariaLabel}
                                                >
                                                  <HelpCircle className="h-3 w-3 shrink-0" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent
                                                side="top"
                                                className="max-w-[300px] p-2.5 text-left text-xs leading-snug font-normal"
                                              >
                                                <p className="font-semibold mb-1">
                                                  {tooltipTitle}
                                                </p>
                                                {tooltipBody}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                      <Input
                                        type="text"
                                        readOnly
                                        disabled
                                        value={value}
                                        className="h-8 text-center text-sm font-semibold tabular-nums bg-gray-50 text-gray-800 cursor-not-allowed"
                                        aria-label={ariaLabel}
                                      />
                                    </div>
                                  );

                                  return (
                                    <div className="flex items-start justify-center gap-2">
                                      {yieldField(
                                        "Expected (%)",
                                        expectedPct == null
                                          ? "N/A"
                                          : `${expectedPct.toFixed(2)}%`,
                                        "Expected yield from costing template",
                                        "Expected Yield (%)",
                                        <p>
                                          From the costing template Output
                                          Percentage field.
                                        </p>,
                                      )}
                                      {yieldField(
                                        "Actual (%)",
                                        yieldPct === null
                                          ? "N/A"
                                          : `${yieldPct.toFixed(2)}%`,
                                        "Actual yield percentage",
                                        "Actual Yield (%)",
                                        <>
                                          <p>
                                            Total output units ÷ Actual raw
                                            material × 100
                                          </p>
                                          {yieldPct !== null &&
                                            rawMaterialQty > 0 && (
                                              <p className="mt-1.5 text-gray-500 tabular-nums">
                                                e.g. {outputQty.toFixed(2)} ÷{" "}
                                                {formatNumber(
                                                  rawMaterialQty.toFixed(2),
                                                )}{" "}
                                                × 100 = {yieldPct.toFixed(2)}%
                                              </p>
                                            )}
                                          {yieldPct != null && perUnit > 0 && (
                                            <p className="mt-1 text-gray-500 tabular-nums">
                                              Amount = ₦
                                              {formatNumber(perUnit.toFixed(2))}{" "}
                                              ÷ {yieldPct.toFixed(2)} = ₦
                                              {formatNumber(amount.toFixed(2))}
                                            </p>
                                          )}
                                        </>,
                                      )}
                                      {yieldField(
                                        "Variance (%)",
                                        varianceMeta == null
                                          ? "N/A"
                                          : `${varianceMeta.variancePp >= 0 ? "+" : ""}${varianceMeta.variancePp.toFixed(2)}`,
                                        "Yield variance",
                                        "Yield Variance",
                                        varianceMeta ? (
                                          <p>
                                            Actual {varianceMeta.actual.toFixed(2)}
                                            % − Expected{" "}
                                            {varianceMeta.expected.toFixed(2)}% ={" "}
                                            {varianceMeta.variancePp >= 0
                                              ? "+"
                                              : ""}
                                            {varianceMeta.variancePp.toFixed(2)}{" "}
                                            pp ({varianceMeta.varianceRel}% vs
                                            expected)
                                          </p>
                                        ) : (
                                          <p>
                                            Enter finished goods and raw
                                            materials to compare actual vs
                                            expected yield.
                                          </p>
                                        ),
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-2 py-2 text-right text-sm text-green-800 tabular-nums">
                                ₦
                                {formatNumber(
                                  getSharedCostOutputAmount().toFixed(2),
                                )}
                              </td>
                              <td className="px-2 py-2 text-center text-xs">
                                {(() => {
                                  const vm = getSharedCostYieldVarianceMeta();
                                  if (!vm || vm.action === "ok") return null;
                                  const cls =
                                    vm.action === "review"
                                      ? "text-amber-600"
                                      : "text-red-600";
                                  const label =
                                    vm.action === "review"
                                      ? "Supervisor review"
                                      : "Reason required";
                                  return (
                                    <span className={`font-semibold ${cls}`}>
                                      {label}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <TemplateByProductSection
                      embedded
                      showCostBreakdown
                      templateByProductOptions={
                        templateByProduct.templateByProductOptions
                      }
                      selectedTemplateByProduct={
                        templateByProduct.selectedTemplateByProduct
                      }
                      onSelectByProduct={(bp) => {
                        if (!bp) {
                          templateByProduct.clearTemplateByProductState();
                          return;
                        }
                        const isDifferentProduct =
                          templateByProduct.selectedTemplateByProduct &&
                          String(bp.id) !==
                            String(
                              templateByProduct.selectedTemplateByProduct.id,
                            );
                        const isFirstSelect =
                          !templateByProduct.selectedTemplateByProduct;
                        templateByProduct.setSelectedTemplateByProduct(bp);
                        if (isFirstSelect || isDifferentProduct) {
                          templateByProduct.handleTemplateByProductQtyChange(
                            "1",
                          );
                        }
                        const bpCost = bp?.cost_price;
                        if (bpCost != null && bpCost !== "") {
                          templateByProduct.setTemplateByProductUnitCost(
                            String(bpCost),
                          );
                        }
                        if (isDifferentProduct) {
                          templateByProduct.setTemplateByProductItems([]);
                          templateByProduct.setTemplateByProductBranchId("");
                        }
                      }}
                      onClear={templateByProduct.clearTemplateByProductState}
                      templateByProductQty={
                        templateByProduct.templateByProductQty
                      }
                      onQtyChange={
                        templateByProduct.handleTemplateByProductQtyChange
                      }
                      templateByProductItems={
                        templateByProduct.templateByProductItems
                      }
                      rawMaterialProducts={rawMaterialProducts}
                      formatRmSelectLabel={
                        templateByProduct.formatRmSelectLabel
                      }
                      onAddRawMaterial={
                        templateByProduct.handleAddTemplateByProductRawMaterial
                      }
                      onRemoveItem={
                        templateByProduct.handleRemoveTemplateByProductItem
                      }
                      onItemChange={
                        templateByProduct.handleTemplateByProductItemChange
                      }
                      branchOptions={templateByProduct.branchOptions}
                      branchesLoading={templateByProduct.branchesLoading}
                      templateByProductBranchId={
                        templateByProduct.templateByProductBranchId
                      }
                      onBranchLocationIdChange={
                        templateByProduct.setTemplateByProductBranchId
                      }
                      templateByProductUnitCost={
                        templateByProduct.templateByProductUnitCost
                      }
                      onUnitCostChange={
                        templateByProduct.setTemplateByProductUnitCost
                      }
                    />

                  </div>
                </div>
              </>
            )}

            {/* Production Items Section */}
            {/* {JSON.stringify(recordDetails?.productionItems)} */}
            {recordDetails?.productionItems &&
            recordDetails.productionItems.length > 0 ? (
              <div className="space-y-6 mb-6">
                {/* <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Package className="text-indigo-600 w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          Production Items
                        </h2>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {recordDetails.productionItems.length}
                        </span>
                      </div>
                    </div> */}

                {/* Production Items List */}
                {recordDetails.productionItems.map((productionItem, index) => (
                  <div
                    key={productionItem.id}
                    className="bg-white rounded-lg overflow-hidden border border-gray-200"
                  >
                    {/* {JSON.stringify(productionItem.finishedGoods)} */}
                    {/* Collapsible Header */}
                    <div
                      onClick={() =>
                        setExpandedProductionItem(
                          expandedProductionItem === productionItem.id
                            ? null
                            : productionItem.id,
                        )
                      }
                      className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 cursor-pointer hover:from-blue-100 hover:to-indigo-100 transition-colors border-b border-gray-100"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[var(--aa-navy)] rounded-lg flex items-center justify-center text-white font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              Production Item #{index + 1}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {productionItem.finishedGoods?.[0]?.finishedGood
                                ?.item_name ||
                                productionItem.finishedGoods?.[0]?.finishedGood
                                  ?.name ||
                                "Select Product"}{" "}
                              • {productionItem.finishedGoods?.length || 0}{" "}
                              finished good(s) •{" "}
                              {productionItem.ingredients?.length || 0}{" "}
                              ingredient(s)
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveProductionItem(productionItem.id);
                            }}
                            className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                            title="Delete Production Item"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="text-gray-400 text-xl">
                            {expandedProductionItem === productionItem.id
                              ? "▼"
                              : "▶"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Item Content - Collapsible */}
                    {expandedProductionItem === productionItem.id && (
                      <div className="space-y-8">
                        {/* Combined Production Card - Finished Goods + Costs */}
                        <div>
                          {/* Card Header */}
                          {/* <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-100 rounded-lg">
                                      <Package className="text-indigo-600 w-5 h-5" />
                                    </div>
                                    <h4 className="text-lg font-bold text-gray-900">
                                      Production Costs for{" "}
                                      <span className="text-indigo-600">
                                        {productionItem.finishedGoods?.[0]
                                          ?.finishedGood?.item_name ||
                                          productionItem.finishedGoods?.[0]
                                            ?.finishedGood?.name ||
                                          "Select Product"}
                                      </span>
                                    </h4>
                                  </div>
                                </div> */}

                          {/* Finished Goods Section */}
                          <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                Finished Goods
                              </h5>
                            </div>
                            <div className="space-y-4">
                              {productionItem.finishedGoods.map(
                                (finishedGood) => (
                                  <div
                                    key={finishedGood.id}
                                    className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm transition-colors"
                                  >
                                    <div className="space-y-4">
                                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Product{" "}
                                            <span className="text-red-500">
                                              *
                                            </span>
                                          </label>
                                          {(() => {
                                            const resolvedProduct =
                                              resolveFinishedGoodFromFgRow(
                                                enrichFinishedGoodRowWithProductContext(
                                                  finishedGood,
                                                  productionItem,
                                                ),
                                                finishedGoodProducts,
                                              );
                                            const existsInList =
                                              resolvedProduct &&
                                              finishedGoodProducts.some((p) =>
                                                productsShareIdentity(
                                                  p,
                                                  resolvedProduct,
                                                ),
                                              );
                                            const typeaheadOptions =
                                              resolvedProduct && !existsInList
                                                ? [
                                                    resolvedProduct,
                                                    ...finishedGoodProducts,
                                                  ]
                                                : finishedGoodProducts;

                                            return (
                                              <Typeahead
                                                id={`finished-good-product-${productionItem.id}-${finishedGood.id}`}
                                                options={typeaheadOptions}
                                                labelKey={(product) =>
                                                  `${
                                                    product.item_name ||
                                                    product.name ||
                                                    "N/A"
                                                  } (${
                                                    product.item_code ||
                                                    product.sku ||
                                                    product.itemCode ||
                                                    product.id ||
                                                    "N/A"
                                                  })`
                                                }
                                                placeholder="Select finished good..."
                                                clearButton
                                                onChange={(selected) => {
                                                  console.log(
                                                    "Finished Good onChange:",
                                                    selected,
                                                  );
                                                  const selectedProduct =
                                                    selected &&
                                                    selected.length > 0
                                                      ? selected[0]
                                                      : null;

                                                  if (selectedProduct) {
                                                    // Update all fields in a single state update
                                                    if (!recordDetails) return;

                                                    const opts =
                                                      templateByProduct.branchOptions;
                                                    const first =
                                                      opts?.length > 0
                                                        ? opts[0]
                                                        : null;
                                                    const branchPatch = first
                                                      ? {
                                                          branchLocationId:
                                                            first.id,
                                                          branch_id:
                                                            first.branch_id ||
                                                            "",
                                                          branch_name:
                                                            first.storeName ||
                                                            first.branch_name ||
                                                            "",
                                                        }
                                                      : {
                                                          branchLocationId:
                                                            null,
                                                          branch_id: "",
                                                          branch_name: "",
                                                        };

                                                    const updatedProductionItems =
                                                      recordDetails.productionItems.map(
                                                        (item) => {
                                                          if (
                                                            item.id ===
                                                            productionItem.id
                                                          ) {
                                                            return {
                                                              ...item,
                                                              finishedGoods:
                                                                item.finishedGoods.map(
                                                                  (fg) => {
                                                                    if (
                                                                      fg.id ===
                                                                      finishedGood.id
                                                                    ) {
                                                                      const updated =
                                                                        {
                                                                          ...fg,
                                                                          finishedGood:
                                                                            selectedProduct,
                                                                          unitOfMeasure:
                                                                            selectedProduct.unit_of_measure ||
                                                                            "",
                                                                          category:
                                                                            selectedProduct.category ||
                                                                            "",
                                                                          ...branchPatch,
                                                                        };
                                                                      // Fetch multipliers
                                                                      const productCode =
                                                                        selectedProduct.item_code ||
                                                                        selectedProduct.sku ||
                                                                        selectedProduct.itemCode;
                                                                      console.log(
                                                                        "Selected product for multipliers:",
                                                                        selectedProduct,
                                                                        "Product Code:",
                                                                        productCode,
                                                                      );
                                                                      if (
                                                                        productCode
                                                                      ) {
                                                                        // Use setTimeout to ensure state is updated first
                                                                        setTimeout(
                                                                          () => {
                                                                            fetchProductsWithMultipliers(
                                                                              productCode,
                                                                            );
                                                                          },
                                                                          100,
                                                                        );
                                                                      } else {
                                                                        console.warn(
                                                                          "No product code found for multiplier fetch",
                                                                        );
                                                                      }
                                                                      return updated;
                                                                    }
                                                                    return fg;
                                                                  },
                                                                ),
                                                            };
                                                          }
                                                          return item;
                                                        },
                                                      );

                                                    setRecordDetails({
                                                      ...recordDetails,
                                                      productionItems:
                                                        updatedProductionItems,
                                                    });
                                                  } else {
                                                    // Clear selection
                                                    if (!recordDetails) return;

                                                    const updatedProductionItems =
                                                      recordDetails.productionItems.map(
                                                        (item) => {
                                                          if (
                                                            item.id ===
                                                            productionItem.id
                                                          ) {
                                                            return {
                                                              ...item,
                                                              finishedGoods:
                                                                item.finishedGoods.map(
                                                                  (fg) => {
                                                                    if (
                                                                      fg.id ===
                                                                      finishedGood.id
                                                                    ) {
                                                                      return {
                                                                        ...fg,
                                                                        finishedGood:
                                                                          null,
                                                                        unitOfMeasure:
                                                                          "",
                                                                        category:
                                                                          "",
                                                                        expiry_date:
                                                                          "",
                                                                        mark_up:
                                                                          "",
                                                                        markup_mode:
                                                                          "percentage",
                                                                        vat_rate:
                                                                          "7.5",
                                                                        apply_vat: true,
                                                                        wasteScrapSellingPrice:
                                                                          "",
                                                                        wasteScrapMarkupMode:
                                                                          "percentage",
                                                                        wasteScrapMarkUp:
                                                                          "",
                                                                        wasteScrapVatRate:
                                                                          "7.5",
                                                                        wasteScrapApplyVat: true,
                                                                        branchLocationId:
                                                                          null,
                                                                        branch_id:
                                                                          "",
                                                                        branch_name:
                                                                          "",
                                                                      };
                                                                    }
                                                                    return fg;
                                                                  },
                                                                ),
                                                            };
                                                          }
                                                          return item;
                                                        },
                                                      );

                                                    setRecordDetails({
                                                      ...recordDetails,
                                                      productionItems:
                                                        updatedProductionItems,
                                                    });
                                                  }
                                                }}
                                                selected={getFinishedGoodTypeaheadSelected(
                                                  finishedGood.finishedGood ||
                                                    resolvedProduct,
                                                  finishedGoodProducts,
                                                )}
                                                positionFixed
                                                className="!text-sm"
                                                inputProps={{
                                                  style: {
                                                    width: "100%",
                                                    padding: "0.5rem 0.75rem",
                                                    fontSize: "0.875rem",
                                                    border:
                                                      "2px solid rgb(203 213 225)",
                                                    borderRadius: "0.5rem",
                                                  },
                                                }}
                                              />
                                            );
                                          })()}
                                          <p className="mt-1 text-xs text-gray-500">
                                            Unit:{" "}
                                            <span className="font-semibold text-indigo-600">
                                              {finishedGood.unitOfMeasure ||
                                                "N/A"}
                                            </span>
                                          </p>
                                        </div>
                                        {(templateByProduct.branchesLoading ||
                                          (templateByProduct.branchOptions
                                            ?.length ?? 0) > 0) && (
                                          <div className="w-full sm:w-64 shrink-0">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                              Warehouse{" "}
                                              {!templateByProduct.branchesLoading && (
                                                <span className="text-red-500">
                                                  *
                                                </span>
                                              )}
                                            </label>
                                            {templateByProduct.branchesLoading ? (
                                              <Skeleton className="h-[38px] w-full rounded-lg" />
                                            ) : (
                                              <select
                                                value={resolveDefaultBranchLocationId(
                                                  finishedGood.branchLocationId,
                                                  templateByProduct.branchOptions,
                                                )}
                                                onChange={(e) =>
                                                  handleFinishedGoodBranchChange(
                                                    productionItem.id,
                                                    finishedGood.id,
                                                    e.target.value,
                                                  )
                                                }
                                                className="w-full h-[38px] px-2 py-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                                              >
                                                {templateByProduct.branchOptions.map(
                                                  (b) => (
                                                    <option
                                                      key={b.id}
                                                      value={String(b.id)}
                                                    >
                                                      {b.storeName ||
                                                        b.branch_name ||
                                                        b.branch_id}
                                                      {b.state
                                                        ? ` — ${b.state}`
                                                        : ""}
                                                    </option>
                                                  ),
                                                )}
                                              </select>
                                            )}
                                          </div>
                                        )}
                                      </div>

                                      {/* Multiplier (process costing) */}
                                      <div className="space-y-2">
                                        {showProcessCostingMultiplierSelect && (
                                          <div className="w-full">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                              Multiplier{" "}
                                              <span className="text-red-500">
                                                *
                                              </span>
                                            </label>
                                            <CreatableSelect
                                              isClearable
                                              isDisabled={
                                                !finishedGood.finishedGood
                                              }
                                              options={allMultipliers.map(
                                                (multiplier) => ({
                                                  value: multiplier.id,
                                                  label: `${multiplier.multiplier_type} (${multiplier.multiplier_value})`,
                                                }),
                                              )}
                                              value={
                                                finishedGood.multiplier
                                                  ? {
                                                      value:
                                                        finishedGood.multiplier
                                                          .id,
                                                      label: `${finishedGood.multiplier.multiplier_type} (${finishedGood.multiplier.multiplier_value})`,
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
                                                handleFinishedGoodMultiplierChange(
                                                  productionItem.id,
                                                  finishedGood.id,
                                                  selected.value,
                                                );
                                              }}
                                              placeholder={
                                                finishedGood.finishedGood
                                                  ? "Select multiplier..."
                                                  : "Select product first"
                                              }
                                              styles={{
                                                control: (base, state) => ({
                                                  ...base,
                                                  border: state.isFocused
                                                    ? "2px solid #10b981"
                                                    : "2px solid #e5e7eb",
                                                  borderRadius: "0.5rem",
                                                  minHeight: "19px",
                                                  fontSize: "1.1rem",
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
                                                  fontWeight: "600",
                                                  fontSize: "1.1rem",
                                                }),
                                                menu: (base) => ({
                                                  ...base,
                                                  fontSize: "1rem",
                                                }),
                                                option: (base) => ({
                                                  ...base,
                                                  fontSize: "1rem",
                                                  padding: "0.875rem 1.25rem",
                                                }),
                                              }}
                                              className="react-select-container"
                                              classNamePrefix="react-select"
                                            />
                                          </div>
                                        )}
                                      </div>

                                      <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/25 overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleFgSection(
                                              "saleable",
                                              productionItem.id,
                                              finishedGood.id,
                                            )
                                          }
                                          className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-emerald-50/60 transition-colors"
                                          aria-expanded={isFgSectionOpen(
                                            "saleable",
                                            productionItem.id,
                                            finishedGood.id,
                                          )}
                                        >
                                          <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wide">
                                              Saleable finished good
                                            </h4>
                                            <p className="text-[11px] text-emerald-800/90 mt-1 leading-snug">
                                              Good quantity and the markup below
                                              apply only to the main product
                                              output — not to scrap inventory.
                                            </p>
                                            {!isFgSectionOpen(
                                              "saleable",
                                              productionItem.id,
                                              finishedGood.id,
                                            ) && (
                                              <p className="text-xs text-emerald-900/90 mt-2 tabular-nums">
                                                Good qty:{" "}
                                                {formatNumber1(
                                                  getCostingGoodQuantity(
                                                    finishedGood,
                                                  ),
                                                )}
                                                {" · "}
                                                Cost/unit: ₦
                                                {formatNumber(
                                                  parseFloat(
                                                    getFinishedGoodCostPerUnitForMarkup(
                                                      productionItem,
                                                      finishedGood,
                                                      {
                                                        multiplierSource:
                                                          "primary",
                                                      },
                                                    ),
                                                  ).toFixed(2),
                                                )}
                                                {" · "}
                                                Selling: ₦
                                                {formatNumber(
                                                  calculateFinishedGoodSellingPrice(
                                                    parseFloat(
                                                      parseFloat(
                                                        getFinishedGoodCostPerUnitForMarkup(
                                                          productionItem,
                                                          finishedGood,
                                                          {
                                                            multiplierSource:
                                                              "primary",
                                                          },
                                                        ),
                                                      ).toFixed(2),
                                                    ),
                                                    finishedGood,
                                                  ),
                                                )}
                                              </p>
                                            )}
                                          </div>
                                          <ChevronDown
                                            className={`h-5 w-5 shrink-0 text-emerald-700 mt-0.5 transition-transform ${
                                              isFgSectionOpen(
                                                "saleable",
                                                productionItem.id,
                                                finishedGood.id,
                                              )
                                                ? "rotate-180"
                                                : ""
                                            }`}
                                          />
                                        </button>
                                        {isFgSectionOpen(
                                          "saleable",
                                          productionItem.id,
                                          finishedGood.id,
                                        ) && (
                                          <div className="px-4 pb-4 pt-0 space-y-4 border-t border-emerald-200/60">
                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                              <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                  Good qty{" "}
                                                  <span className="text-red-500">
                                                    *
                                                  </span>
                                                </label>
                                                <Input
                                                  type="text"
                                                  value={
                                                    finishedGood.goodQuantity_formatted !==
                                                    undefined
                                                      ? finishedGood.goodQuantity_formatted
                                                      : finishedGood.goodQuantity !==
                                                            null &&
                                                          finishedGood.goodQuantity !==
                                                            undefined &&
                                                          finishedGood.goodQuantity !==
                                                            ""
                                                        ? formatNumberWithCommas(
                                                            finishedGood.goodQuantity.toString(),
                                                          )
                                                        : "0.0000"
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateFinishedGood(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      "goodQuantity",
                                                      e.target.value,
                                                    )
                                                  }
                                                  placeholder="0.0000"
                                                  className="w-full text-left border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                                                />
                                              </div>
                                            </div>

                                            <div
                                              className={
                                                "grid grid-cols-1 gap-3 " +
                                                (shouldShowVatInputForPolicy()
                                                  ? "sm:grid-cols-3"
                                                  : "sm:grid-cols-2")
                                              }
                                            >
                                              {/* Markup Type — finished good only */}
                                              <div className="w-full">
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                  Markup type (finished good)
                                                </label>
                                                <select
                                                  value={
                                                    finishedGood.markup_mode ||
                                                    "percentage"
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateFinishedGood(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      "markup_mode",
                                                      e.target.value,
                                                    )
                                                  }
                                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                                                >
                                                  <option value="percentage">
                                                    Percentage (%)
                                                  </option>
                                                  <option value="fixed">
                                                    Fixed (N)
                                                  </option>
                                                </select>
                                              </div>

                                              {/* Markup Value — finished good only */}
                                              <div className="w-full">
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                  Markup (finished good)
                                                </label>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={
                                                    finishedGood.mark_up ?? ""
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateFinishedGood(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      "mark_up",
                                                      e.target.value,
                                                    )
                                                  }
                                                  placeholder="0"
                                                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                                                />
                                              </div>

                                              {/* VAT Controls */}
                                              {shouldShowVatInputForPolicy() && (
                                                <div className="w-full">
                                                  <div className="mb-1.5 flex items-center justify-between">
                                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                      VAT % (finished good)
                                                    </label>
                                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                                      <input
                                                        type="checkbox"
                                                        checked={
                                                          finishedGood.apply_vat !==
                                                          false
                                                        }
                                                        onChange={(e) =>
                                                          handleUpdateFinishedGood(
                                                            productionItem.id,
                                                            finishedGood.id,
                                                            "apply_vat",
                                                            e.target.checked,
                                                          )
                                                        }
                                                      />
                                                      Apply VAT
                                                    </label>
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      step="0.01"
                                                      value={
                                                        finishedGood.vat_rate ??
                                                        "7.5"
                                                      }
                                                      onChange={(e) =>
                                                        handleUpdateFinishedGood(
                                                          productionItem.id,
                                                          finishedGood.id,
                                                          "vat_rate",
                                                          e.target.value,
                                                        )
                                                      }
                                                      disabled={
                                                        finishedGood.apply_vat ===
                                                        false
                                                      }
                                                      placeholder="7.5"
                                                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)] disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            {/* Multiplier / Value */}
                                            {showFinishedGoodMultiplierValue && (
                                              <div className="w-full space-y-2 rounded-lg border border-purple-100 bg-purple-50/40 p-3">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                  Multiplier / Value
                                                </label>
                                                <Input
                                                  type="number"
                                                  value={
                                                    finishedGood.multiplierValue ||
                                                    1.0
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateFinishedGood(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      "multiplierValue",
                                                      parseFloat(
                                                        e.target.value,
                                                      ) || 1.0,
                                                    )
                                                  }
                                                  min="0"
                                                  step="0.01"
                                                  placeholder="1.0"
                                                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                />
                                                {/* Display output units × Multiplier/Value */}
                                                {(() => {
                                                  const quantity =
                                                    getFinishedGoodOutputUnits(
                                                      finishedGood,
                                                    );
                                                  const multiplierValue =
                                                    getFinishedGoodMultiplierValue(
                                                      finishedGood,
                                                    );
                                                  const totalUsed =
                                                    getFinishedGoodQtyTimesMultiplier(
                                                      finishedGood,
                                                    );
                                                  return (
                                                    <p className="mt-1.5 text-xs text-blue-600">
                                                      {formatNumber(
                                                        quantity.toFixed(2),
                                                      )}{" "}
                                                      ×{" "}
                                                      {formatNumber(
                                                        multiplierValue.toFixed(
                                                          2,
                                                        ),
                                                      )}{" "}
                                                      ={" "}
                                                      <span className="font-bold">
                                                        {formatNumber(
                                                          totalUsed.toFixed(2),
                                                        )}
                                                      </span>
                                                    </p>
                                                  );
                                                })()}
                                                {(() => {
                                                  const costingType =
                                                    selectedRecord?.costing_type ||
                                                    selectedRecord?.type ||
                                                    selectedRecord?.costingType;
                                                  if (
                                                    costingType !==
                                                      "joint_shared" ||
                                                    !sharedCosts.length
                                                  ) {
                                                    return null;
                                                  }
                                                  const multiplierValue =
                                                    getFinishedGoodMultiplierValue(
                                                      finishedGood,
                                                    );
                                                  const totalUsed =
                                                    getFinishedGoodQtyTimesMultiplier(
                                                      finishedGood,
                                                    );
                                                  const outputAmount =
                                                    getSharedCostOutputAmount();
                                                  const batchShared = Number(
                                                    (
                                                      outputAmount * totalUsed
                                                    ).toFixed(2),
                                                  );
                                                  const perGoodQtyShared =
                                                    Number(
                                                      (
                                                        outputAmount *
                                                        multiplierValue
                                                      ).toFixed(2),
                                                    );
                                                  return (
                                                    <div className="mt-1.5 space-y-1">
                                                      <p className="text-xs text-gray-600">
                                                        Unit cost (shared):{" "}
                                                        <span className="text-green-700 font-bold tabular-nums">
                                                          ₦
                                                          {formatNumber(
                                                            outputAmount.toFixed(
                                                              2,
                                                            ),
                                                          )}
                                                        </span>
                                                      </p>
                                                      <p className="text-xs text-gray-600">
                                                        Per good qty:{" "}
                                                        <span className="text-purple-700 font-bold tabular-nums">
                                                          ₦
                                                          {formatNumber(
                                                            outputAmount.toFixed(
                                                              2,
                                                            ),
                                                          )}{" "}
                                                          ×{" "}
                                                          {formatNumber(
                                                            multiplierValue.toFixed(
                                                              2,
                                                            ),
                                                          )}{" "}
                                                          = ₦
                                                          {formatNumber(
                                                            perGoodQtyShared.toFixed(
                                                              2,
                                                            ),
                                                          )}
                                                        </span>
                                                      </p>
                                                      <p className="text-xs text-gray-600">
                                                        Total:{" "}
                                                        <span className="text-indigo-600 font-bold tabular-nums">
                                                          {formatNumber(
                                                            totalUsed.toFixed(2),
                                                          )}{" "}
                                                          × ₦
                                                          {formatNumber(
                                                            outputAmount.toFixed(
                                                              2,
                                                            ),
                                                          )}{" "}
                                                          = ₦
                                                          {formatNumber(
                                                            batchShared.toFixed(
                                                              2,
                                                            ),
                                                          )}
                                                        </span>
                                                      </p>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            )}

                                            {(() => {
                                              const cpuRaw =
                                                getFinishedGoodCostPerUnitForMarkup(
                                                  productionItem,
                                                  finishedGood,
                                                  {
                                                    multiplierSource: "primary",
                                                  },
                                                );
                                              const roundedCostPerUnit =
                                                parseFloat(
                                                  parseFloat(cpuRaw).toFixed(2),
                                                );
                                              const sellingPrice =
                                                calculateFinishedGoodSellingPrice(
                                                  roundedCostPerUnit,
                                                  finishedGood,
                                                );

                                              return (
                                                <div className="flex flex-wrap items-center gap-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
                                                  <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">
                                                      Cost/unit (good)
                                                    </p>
                                                    <p className="text-sm font-semibold text-indigo-600">
                                                      ₦
                                                      {formatNumber(
                                                        roundedCostPerUnit,
                                                      )}
                                                    </p>
                                                  </div>
                                                  <div
                                                    className="hidden sm:block w-px h-8 bg-gray-200"
                                                    aria-hidden
                                                  />
                                                  <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">
                                                      Selling price (good)
                                                    </p>
                                                    <p className="text-sm font-semibold text-emerald-600">
                                                      ₦
                                                      {formatNumber(
                                                        sellingPrice,
                                                      )}
                                                    </p>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>

                                      {(parseFloat(
                                        String(
                                          finishedGood.wasteQuantity ?? "",
                                        ).replace(/,/g, ""),
                                      ) || 0) > 0 && (
                                        <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30 overflow-hidden mt-4">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleFgSection(
                                                "waste",
                                                productionItem.id,
                                                finishedGood.id,
                                              )
                                            }
                                            className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-amber-50/70 transition-colors"
                                            aria-expanded={isFgSectionOpen(
                                              "waste",
                                              productionItem.id,
                                              finishedGood.id,
                                            )}
                                          >
                                            <div className="min-w-0 flex-1">
                                              <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wide">
                                                Waste and recyclables
                                              </h4>
                                              <p className="text-[11px] text-amber-900/85 mt-1 leading-snug">
                                                Waste quantity and posting
                                                options below. Scrap /
                                                by-product pricing is separate
                                                from the finished-good markup in
                                                the green section.
                                              </p>
                                              {!isFgSectionOpen(
                                                "waste",
                                                productionItem.id,
                                                finishedGood.id,
                                              ) && (
                                                <p className="text-xs text-amber-900/90 mt-2 capitalize">
                                                  Waste qty:{" "}
                                                  {formatNumber1(
                                                    parseFloat(
                                                      String(
                                                        finishedGood.wasteQuantity ??
                                                          "",
                                                      ).replace(/,/g, ""),
                                                    ) || 0,
                                                  )}
                                                  {parseStoredWasteType(
                                                    finishedGood,
                                                  )
                                                    ? ` · Type: ${parseStoredWasteType(finishedGood)}`
                                                    : ""}
                                                  {finishedGood.wasteReason
                                                    ? ` · Reason: ${String(finishedGood.wasteReason).slice(0, 40)}${String(finishedGood.wasteReason).length > 40 ? "…" : ""}`
                                                    : ""}
                                                </p>
                                              )}
                                            </div>
                                            <ChevronDown
                                              className={`h-5 w-5 shrink-0 text-amber-700 mt-0.5 transition-transform ${
                                                isFgSectionOpen(
                                                  "waste",
                                                  productionItem.id,
                                                  finishedGood.id,
                                                )
                                                  ? "rotate-180"
                                                  : ""
                                              }`}
                                            />
                                          </button>
                                          {isFgSectionOpen(
                                            "waste",
                                            productionItem.id,
                                            finishedGood.id,
                                          ) && (
                                            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-amber-200/60">
                                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                                                <div>
                                                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                    Waste qty{" "}
                                                    <span className="text-red-500">
                                                      *
                                                    </span>
                                                  </label>
                                                  <Input
                                                    type="text"
                                                    value={
                                                      finishedGood.wasteQuantity ??
                                                      "0.0000"
                                                    }
                                                    onChange={(e) =>
                                                      handleUpdateFinishedGood(
                                                        productionItem.id,
                                                        finishedGood.id,
                                                        "wasteQuantity",
                                                        e.target.value,
                                                      )
                                                    }
                                                    placeholder="0.0000"
                                                    className="w-full text-left border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                                                  />
                                                </div>
                                                {(parseFloat(
                                                  finishedGood.wasteQuantity ??
                                                    0,
                                                ) || 0) > 0 && (
                                                  <div>
                                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                      Waste type{" "}
                                                      <span className="text-red-500">
                                                        *
                                                      </span>
                                                    </label>
                                                    <select
                                                      value={parseStoredWasteType(
                                                        finishedGood,
                                                      )}
                                                      onChange={(e) =>
                                                        handleUpdateFinishedGood(
                                                          productionItem.id,
                                                          finishedGood.id,
                                                          "wasteType",
                                                          e.target.value,
                                                        )
                                                      }
                                                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                                                    >
                                                      <option value="">
                                                        Select waste type
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
                                                    <p className="text-[11px] text-gray-600">
                                                      May default from Record
                                                      Production; you can change
                                                      it here before Complete
                                                      Batch.
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                              <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                  Waste reason
                                                </label>
                                                <textarea
                                                  rows={2}
                                                  value={
                                                    finishedGood.wasteReason ||
                                                    ""
                                                  }
                                                  onChange={(e) =>
                                                    handleUpdateFinishedGood(
                                                      productionItem.id,
                                                      finishedGood.id,
                                                      "wasteReason",
                                                      e.target.value,
                                                    )
                                                  }
                                                  placeholder="Enter waste reason"
                                                  className="w-full min-h-0 max-h-24 resize-y border border-gray-300 rounded-md px-3 py-1.5 text-sm leading-snug focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-[var(--aa-accent)]"
                                                />
                                              </div>

                                              {(parseFloat(
                                                finishedGood.wasteQuantity ?? 0,
                                              ) || 0) > 0 && (
                                                <div className="space-y-3 pt-1 border-t border-amber-200/80">
                                                  <div className="w-full">
                                                    {(() => {
                                                      const rawWtMid =
                                                        typeof finishedGood.wasteType ===
                                                        "string"
                                                          ? finishedGood.wasteType
                                                          : finishedGood
                                                              .wasteType
                                                              ?.value ||
                                                            finishedGood
                                                              .wasteType
                                                              ?.label ||
                                                            finishedGood.waste_type ||
                                                            "";
                                                      const wtrMid = String(
                                                        rawWtMid,
                                                      )
                                                        .trim()
                                                        .toLowerCase();
                                                      if (wtrMid === "normal") {
                                                        return (
                                                          <div
                                                            aria-hidden
                                                            className="min-h-0 sm:min-h-[1px]"
                                                          />
                                                        );
                                                      }
                                                      if (
                                                        wtrMid === "abnormal"
                                                      ) {
                                                        const journalUnitCost =
                                                          getJournalUnitCostForPosting(
                                                            productionItem,
                                                            finishedGood,
                                                          );
                                                        const goodQtyAb =
                                                          getCostingGoodQuantity(
                                                            finishedGood,
                                                          );
                                                        const wasteQtyAb =
                                                          parseFloat(
                                                            finishedGood.wasteQuantity ??
                                                              0,
                                                          ) || 0;
                                                        const fgPostAmount =
                                                          Number(
                                                            (
                                                              journalUnitCost *
                                                              goodQtyAb
                                                            ).toFixed(2),
                                                          );
                                                        const wastePostAmount =
                                                          Number(
                                                            (
                                                              journalUnitCost *
                                                              wasteQtyAb
                                                            ).toFixed(2),
                                                          );
                                                        const batchPostTotal =
                                                          Number(
                                                            (
                                                              fgPostAmount +
                                                              wastePostAmount
                                                            ).toFixed(2),
                                                          );
                                                        const batchBreakdownTotal =
                                                          computeProductionCostTotals(
                                                            productionItem,
                                                          ).totalBatchCost;
                                                        return (
                                                          <div className="space-y-3">
                                                            <details
                                                              open
                                                              className="group rounded-md border border-slate-200 bg-white text-xs text-slate-800"
                                                            >
                                                              <summary className="cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
                                                                <div className="flex items-start justify-between gap-2">
                                                                  <div className="min-w-0">
                                                                    <p className="font-semibold text-slate-700">
                                                                      Unit cost
                                                                      (from Cost
                                                                      Breakdown)
                                                                    </p>
                                                                    <p className="tabular-nums text-slate-800 mt-0.5">
                                                                      ₦
                                                                      {formatNumber(
                                                                        journalUnitCost.toFixed(
                                                                          2,
                                                                        ),
                                                                      )}{" "}
                                                                      per unit
                                                                    </p>
                                                                  </div>
                                                                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 mt-0.5 transition-transform group-open:rotate-180" />
                                                                </div>
                                                              </summary>
                                                              <div className="space-y-1 border-t border-slate-100 px-3 pb-2 pt-2">
                                                                <p>
                                                                  Good output:{" "}
                                                                  <span className="font-semibold tabular-nums">
                                                                    ₦
                                                                    {formatNumber(
                                                                      fgPostAmount.toFixed(
                                                                        2,
                                                                      ),
                                                                    )}
                                                                  </span>{" "}
                                                                  (
                                                                  {formatNumber1(
                                                                    goodQtyAb,
                                                                  )}{" "}
                                                                  × unit cost)
                                                                </p>
                                                                <p>
                                                                  Abnormal
                                                                  waste:{" "}
                                                                  <span className="font-semibold tabular-nums">
                                                                    ₦
                                                                    {formatNumber(
                                                                      wastePostAmount.toFixed(
                                                                        2,
                                                                      ),
                                                                    )}
                                                                  </span>{" "}
                                                                  (
                                                                  {formatNumber1(
                                                                    wasteQtyAb,
                                                                  )}{" "}
                                                                  × unit cost)
                                                                </p>
                                                                <p className="font-semibold text-slate-900 pt-1">
                                                                  Posting total:{" "}
                                                                  <span className="tabular-nums">
                                                                    ₦
                                                                    {formatNumber(
                                                                      batchPostTotal.toFixed(
                                                                        2,
                                                                      ),
                                                                    )}
                                                                  </span>
                                                                  {Math.abs(
                                                                    batchPostTotal -
                                                                      batchBreakdownTotal,
                                                                  ) > 0.02 ? (
                                                                    <span className="block font-normal text-amber-800 mt-0.5">
                                                                      Cost
                                                                      Breakdown
                                                                      batch
                                                                      total is ₦
                                                                      {formatNumber(
                                                                        batchBreakdownTotal.toFixed(
                                                                          2,
                                                                        ),
                                                                      )}
                                                                    </span>
                                                                  ) : (
                                                                    <span className="block font-normal text-slate-600 mt-0.5">
                                                                      Matches
                                                                      Cost
                                                                      Breakdown
                                                                      batch
                                                                      total
                                                                    </span>
                                                                  )}
                                                                </p>
                                                              </div>
                                                            </details>
                                                            <div>
                                                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                                Abnormal loss
                                                                account
                                                              </label>
                                                              <Typeahead
                                                                id={`post-abnormal-${finishedGood.id}`}
                                                                options={
                                                                  expenseList ||
                                                                  []
                                                                }
                                                                labelKey={(o) =>
                                                                  `${o.name || ""} (${o.code || ""})`
                                                                }
                                                                placeholder="Search expense account…"
                                                                selected={
                                                                  finishedGood.wasteAbnormalLossExpenseSelection ||
                                                                  []
                                                                }
                                                                onChange={(
                                                                  sel,
                                                                ) =>
                                                                  handleUpdateFinishedGood(
                                                                    productionItem.id,
                                                                    finishedGood.id,
                                                                    "wasteAbnormalLossExpenseSelection",
                                                                    sel || [],
                                                                  )
                                                                }
                                                                clearButton
                                                                className="w-full"
                                                                inputProps={{
                                                                  className:
                                                                    "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md",
                                                                }}
                                                              />
                                                            </div>
                                                          </div>
                                                        );
                                                      }
                                                      if (
                                                        wtrMid === "recyclable"
                                                      ) {
                                                        return (
                                                          <div>
                                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                                              Scrap / By-product
                                                            </label>
                                                            <Typeahead
                                                              id={`post-scrap-bp-${finishedGood.id}`}
                                                              options={
                                                                scrapByProductOptions
                                                              }
                                                              labelKey={(o) =>
                                                                `${o.item_name || ""} (${o.sku || o.item_code || ""})`
                                                              }
                                                              placeholder="By-product (inventory account)"
                                                              selected={
                                                                finishedGood.wasteScrapByProductSelection ||
                                                                []
                                                              }
                                                              onChange={(sel) =>
                                                                handleUpdateFinishedGood(
                                                                  productionItem.id,
                                                                  finishedGood.id,
                                                                  "wasteScrapByProductSelection",
                                                                  sel || [],
                                                                )
                                                              }
                                                              clearButton
                                                              className="w-full"
                                                              inputProps={{
                                                                id: `scrap-by-product-focus-${finishedGood.id}`,
                                                                className:
                                                                  "w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md",
                                                              }}
                                                            />
                                                            {finishedGood
                                                              .wasteScrapByProductSelection?.[0] &&
                                                              !String(
                                                                finishedGood
                                                                  .wasteScrapByProductSelection[0]
                                                                  .inventory_account ||
                                                                  "",
                                                              ).trim() && (
                                                                <p className="text-[10px] text-amber-700 mt-1 leading-snug">
                                                                  This
                                                                  By-product has
                                                                  no inventory
                                                                  account code —
                                                                  set it on the
                                                                  item in
                                                                  inventory.
                                                                </p>
                                                              )}
                                                            {(() => {
                                                              const cpuRaw =
                                                                getFinishedGoodCostPerUnitForMarkup(
                                                                  productionItem,
                                                                  finishedGood,
                                                                  {
                                                                    multiplierSource:
                                                                      "row",
                                                                  },
                                                                );
                                                              const scrapCostUnit =
                                                                parseFloat(
                                                                  parseFloat(
                                                                    cpuRaw,
                                                                  ).toFixed(2),
                                                                );
                                                              const computedScrapSp =
                                                                calculateScrapSellingPriceForStore(
                                                                  scrapCostUnit,
                                                                  finishedGood,
                                                                );
                                                              const manualSp =
                                                                parseFloat(
                                                                  String(
                                                                    finishedGood.wasteScrapSellingPrice ??
                                                                      "",
                                                                  ).replace(
                                                                    /,/g,
                                                                    "",
                                                                  ),
                                                                );
                                                              const effectiveScrapSp =
                                                                Number.isFinite(
                                                                  manualSp,
                                                                ) &&
                                                                manualSp > 0
                                                                  ? manualSp
                                                                  : computedScrapSp;
                                                              return (
                                                                <div className="space-y-3">
                                                                  <div className="px-3 py-2.5 bg-white border border-amber-300/60 rounded-md">
                                                                    <p className="text-[10px] font-semibold text-amber-900 uppercase mb-2">
                                                                      Scrap unit
                                                                      economics
                                                                    </p>
                                                                    <div className="flex flex-wrap items-center gap-6">
                                                                      <div>
                                                                        <p className="text-[10px] text-gray-500 mb-0.5">
                                                                          Cost/unit
                                                                          (scrap)
                                                                        </p>
                                                                        <p className="text-sm font-semibold text-indigo-600">
                                                                          ₦
                                                                          {formatNumber(
                                                                            scrapCostUnit,
                                                                          )}
                                                                        </p>
                                                                      </div>
                                                                      <div
                                                                        className="hidden sm:block w-px h-8 bg-gray-200"
                                                                        aria-hidden
                                                                      />
                                                                      <div>
                                                                        <p className="text-[10px] text-gray-500 mb-0.5">
                                                                          Selling
                                                                          price
                                                                          (scrap)
                                                                        </p>
                                                                        <p className="text-sm font-semibold text-emerald-600">
                                                                          ₦
                                                                          {formatNumber(
                                                                            effectiveScrapSp,
                                                                          )}
                                                                        </p>
                                                                        <p className="text-[10px] text-gray-500 mt-1">
                                                                          Uses
                                                                          scrap
                                                                          markup
                                                                          and
                                                                          VAT
                                                                          only
                                                                          (green
                                                                          section
                                                                          does
                                                                          not
                                                                          apply
                                                                          here).
                                                                        </p>
                                                                      </div>
                                                                    </div>
                                                                  </div>
                                                                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                                                                    <div>
                                                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                                                        Scrap
                                                                        selling
                                                                        price
                                                                        (₦) /
                                                                        unit
                                                                      </label>
                                                                      <Input
                                                                        type="text"
                                                                        value={
                                                                          finishedGood.wasteScrapSellingPrice ??
                                                                          ""
                                                                        }
                                                                        onChange={(
                                                                          e,
                                                                        ) =>
                                                                          handleUpdateFinishedGood(
                                                                            productionItem.id,
                                                                            finishedGood.id,
                                                                            "wasteScrapSellingPrice",
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          )
                                                                        }
                                                                        placeholder="Optional override"
                                                                        className="w-full text-sm"
                                                                      />
                                                                    </div>
                                                                    <div>
                                                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                                                        Markup
                                                                        type
                                                                        (scrap)
                                                                      </label>
                                                                      <select
                                                                        value={
                                                                          finishedGood.wasteScrapMarkupMode ||
                                                                          "percentage"
                                                                        }
                                                                        onChange={(
                                                                          e,
                                                                        ) =>
                                                                          handleUpdateFinishedGood(
                                                                            productionItem.id,
                                                                            finishedGood.id,
                                                                            "wasteScrapMarkupMode",
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          )
                                                                        }
                                                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md"
                                                                      >
                                                                        <option value="percentage">
                                                                          Percentage
                                                                          (%)
                                                                        </option>
                                                                        <option value="fixed">
                                                                          Fixed
                                                                          (₦)
                                                                        </option>
                                                                      </select>
                                                                    </div>
                                                                    <div>
                                                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                                                        Markup
                                                                        (scrap)
                                                                      </label>
                                                                      <Input
                                                                        type="text"
                                                                        value={
                                                                          finishedGood.wasteScrapMarkUp ??
                                                                          ""
                                                                        }
                                                                        onChange={(
                                                                          e,
                                                                        ) =>
                                                                          handleUpdateFinishedGood(
                                                                            productionItem.id,
                                                                            finishedGood.id,
                                                                            "wasteScrapMarkUp",
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          )
                                                                        }
                                                                        placeholder="0"
                                                                        className="w-full text-sm"
                                                                      />
                                                                    </div>
                                                                    <div>
                                                                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                                                                        VAT %
                                                                        (scrap)
                                                                      </label>
                                                                      <Input
                                                                        type="text"
                                                                        value={
                                                                          finishedGood.wasteScrapVatRate ??
                                                                          "7.5"
                                                                        }
                                                                        disabled={
                                                                          finishedGood.wasteScrapApplyVat ===
                                                                          false
                                                                        }
                                                                        onChange={(
                                                                          e,
                                                                        ) =>
                                                                          handleUpdateFinishedGood(
                                                                            productionItem.id,
                                                                            finishedGood.id,
                                                                            "wasteScrapVatRate",
                                                                            e
                                                                              .target
                                                                              .value,
                                                                          )
                                                                        }
                                                                        className="w-full text-sm"
                                                                      />
                                                                    </div>
                                                                    <div className="flex items-end pb-1">
                                                                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                                                        <input
                                                                          type="checkbox"
                                                                          checked={
                                                                            finishedGood.wasteScrapApplyVat !==
                                                                            false
                                                                          }
                                                                          onChange={(
                                                                            e,
                                                                          ) =>
                                                                            handleUpdateFinishedGood(
                                                                              productionItem.id,
                                                                              finishedGood.id,
                                                                              "wasteScrapApplyVat",
                                                                              e
                                                                                .target
                                                                                .checked,
                                                                            )
                                                                          }
                                                                        />
                                                                        Apply
                                                                        VAT
                                                                        (scrap)
                                                                      </label>
                                                                    </div>
                                                                  </div>
                                                                </div>
                                                              );
                                                            })()}
                                                          </div>
                                                        );
                                                      }
                                                      return (
                                                        <div
                                                          aria-hidden
                                                          className="min-h-0 sm:min-h-[1px]"
                                                        />
                                                      );
                                                    })()}
                                                  </div>
                                                </div>
                                              )}

                                              {(() => {
                                                const rawWtNote =
                                                  typeof finishedGood.wasteType ===
                                                  "string"
                                                    ? finishedGood.wasteType
                                                    : finishedGood.wasteType
                                                        ?.value ||
                                                      finishedGood.wasteType
                                                        ?.label ||
                                                      finishedGood.waste_type ||
                                                      "";
                                                const wtrNote = String(
                                                  rawWtNote,
                                                )
                                                  .trim()
                                                  .toLowerCase();
                                                const wasteQtyNote =
                                                  parseFloat(
                                                    finishedGood.wasteQuantity ??
                                                      0,
                                                  ) || 0;
                                                const wasteTypeName =
                                                  {
                                                    normal: "Normal",
                                                    abnormal: "Abnormal",
                                                    recyclable: "Recyclable",
                                                  }[wtrNote] || wtrNote;
                                                if (
                                                  wasteQtyNote <= 0 ||
                                                  !wtrNote ||
                                                  ![
                                                    "normal",
                                                    "abnormal",
                                                    "recyclable",
                                                  ].includes(wtrNote)
                                                ) {
                                                  return null;
                                                }
                                                return (
                                                  <div className="flex gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                                                    <FaInfoCircle
                                                      className="mt-0.5 shrink-0 text-amber-600"
                                                      aria-hidden
                                                    />
                                                    <div className="min-w-0 leading-snug">
                                                      {wtrNote === "normal" && (
                                                        <p>
                                                          <span className="font-semibold">
                                                            {wasteTypeName}:
                                                          </span>{" "}
                                                          Cost per unit divides
                                                          total production cost
                                                          by{" "}
                                                          <span className="font-semibold">
                                                            good qty only
                                                          </span>
                                                          . Waste units are
                                                          absorbed into the cost
                                                          of good output (not
                                                          good qty + waste qty).
                                                        </p>
                                                      )}
                                                      {wtrNote ===
                                                        "abnormal" && (
                                                        <p>
                                                          <span className="font-semibold">
                                                            {wasteTypeName}:
                                                          </span>{" "}
                                                          Cost/unit (good) stays
                                                          the same when you
                                                          change waste type. On
                                                          Complete Batch,
                                                          materials post for
                                                          good + waste qty; FG
                                                          receives{" "}
                                                          <span className="font-semibold">
                                                            unit cost × good qty
                                                          </span>
                                                          , abnormal loss
                                                          receives{" "}
                                                          <span className="font-semibold">
                                                            unit cost × waste
                                                            qty
                                                          </span>
                                                          .
                                                        </p>
                                                      )}
                                                      {wtrNote ===
                                                        "recyclable" && (
                                                        <p>
                                                          <span className="font-semibold">
                                                            {wasteTypeName}:
                                                          </span>{" "}
                                                          Cost/unit (good) stays
                                                          the same when you
                                                          change waste type. On
                                                          Complete Batch, scrap
                                                          inventory receives{" "}
                                                          <span className="font-semibold">
                                                            unit cost × waste
                                                            qty
                                                          </span>{" "}
                                                          (same unit rate as
                                                          FG).
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })()}

                                              {(() => {
                                                const rawWtGl =
                                                  typeof finishedGood.wasteType ===
                                                  "string"
                                                    ? finishedGood.wasteType
                                                    : finishedGood.wasteType
                                                        ?.value ||
                                                      finishedGood.wasteType
                                                        ?.label ||
                                                      finishedGood.waste_type ||
                                                      "";
                                                const wtrGl = String(rawWtGl)
                                                  .trim()
                                                  .toLowerCase();
                                                if (
                                                  wtrGl !== "abnormal" &&
                                                  wtrGl !== "recyclable"
                                                ) {
                                                  return null;
                                                }
                                                const isAbnormal =
                                                  wtrGl === "abnormal";
                                                const selAb =
                                                  finishedGood
                                                    .wasteAbnormalLossExpenseSelection?.[0];
                                                const selSc =
                                                  finishedGood
                                                    .wasteScrapByProductSelection?.[0];
                                                let acc;
                                                if (
                                                  isAbnormal &&
                                                  selAb?.code != null &&
                                                  String(selAb.code).trim() !==
                                                    ""
                                                ) {
                                                  acc = {
                                                    code: String(
                                                      selAb.code,
                                                    ).trim(),
                                                    description:
                                                      selAb.name || null,
                                                  };
                                                } else if (
                                                  !isAbnormal &&
                                                  selSc?.inventory_account !=
                                                    null &&
                                                  String(
                                                    selSc.inventory_account,
                                                  ).trim() !== ""
                                                ) {
                                                  acc = {
                                                    code: String(
                                                      selSc.inventory_account,
                                                    ).trim(),
                                                    description:
                                                      selSc.item_name ||
                                                      selSc.sku ||
                                                      null,
                                                  };
                                                } else {
                                                  acc =
                                                    getResolvedPostingAccountDisplay(
                                                      isAbnormal
                                                        ? "abnormal_loss_account"
                                                        : "scrap_inventory_account",
                                                      isAbnormal
                                                        ? "Abnormal Loss"
                                                        : "Scrap Inventory",
                                                    );
                                                }
                                                const heading = isAbnormal
                                                  ? "Abnormal loss (chart of accounts)"
                                                  : "Scrap / by-product inventory (chart of accounts)";
                                                const settingsHash = isAbnormal
                                                  ? "production-abnormal-loss-account"
                                                  : "production-scrap-inventory-account";
                                                return (
                                                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
                                                    <p className="font-semibold text-slate-700 mb-1">
                                                      {heading}
                                                    </p>
                                                    {acc.code ? (
                                                      <p className="font-mono leading-snug">
                                                        <span className="font-semibold text-slate-900">
                                                          {acc.code}
                                                        </span>
                                                        {acc.description ? (
                                                          <span className="text-slate-600 font-sans">
                                                            {" "}
                                                            — {acc.description}
                                                          </span>
                                                        ) : null}
                                                      </p>
                                                    ) : (
                                                      <p className="text-amber-800 leading-snug">
                                                        No account resolved yet.
                                                        Set{" "}
                                                        {isAbnormal
                                                          ? "Abnormal Loss"
                                                          : "Scrap Inventory"}{" "}
                                                        on the business or chart
                                                        of accounts.{" "}
                                                        <Link
                                                          to={`/app/admin/settings#${settingsHash}`}
                                                          className="font-medium text-blue-700 underline underline-offset-2"
                                                        >
                                                          Open Account Settings
                                                        </Link>
                                                      </p>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* <div className="flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleRemoveFinishedGood(
                                                    productionItem.id,
                                                    finishedGood.id,
                                                  )
                                                }
                                                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                                                title="Remove"
                                              >
                                                <Trash2 size={16} />
                                              </button>
                                            </div> */}
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>

                          {/* Production Costs Section */}
                          <div className="">
                            <div className="flex justify-between items-center p-2">
                              <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                Cost Breakdown
                              </h5>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <UIButton
                                    size="sm"
                                    className="text-xs bg-[var(--aa-navy)] text-white hover:bg-blue-700"
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Line
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </UIButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      handleAddIngredient(
                                        productionItem.id,
                                        "raw_material",
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                                    Raw Material
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      handleAddIngredient(
                                        productionItem.id,
                                        "by_product_credit",
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                                    By-product credit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      handleAddIngredient(
                                        productionItem.id,
                                        "other",
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <span className="w-3 h-3 bg-gray-500 rounded-full mr-2"></span>
                                    Other
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Unified Production Costs Table */}
                            <div className="overflow-x-auto">
                              {(() => {
                                const costBreakdownBalances =
                                  buildProductionCostBreakdownBalances(
                                    productionItem,
                                  );
                                return (
                                  <>
                                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-t-lg border-b-0">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-1 py-2 text-left text-xs font-bold text-gray-700 uppercase w-24">
                                            Type
                                          </th>
                                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase w-64">
                                            Account
                                          </th>
                                          <th className="px-2 py-2 text-left text-xs font-bold text-gray-700 uppercase">
                                            Description
                                          </th>
                                          <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase w-20">
                                            Input
                                          </th>
                                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                            Rate / Basis
                                          </th>
                                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                                            Qty / unit &amp; expected
                                          </th>
                                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase w-24">
                                            Actual Qty
                                          </th>
                                          <th className="px-2 py-2 text-right text-xs font-bold text-gray-700 uppercase">
                                            Balance (₦)
                                            <span className="block text-[10px] font-normal normal-case text-gray-500">
                                              per unit / running
                                            </span>
                                          </th>
                                          <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase bg-gray-100">
                                            Action
                                          </th>
                                        </tr>
                                      </thead>
                                      {/* {JSON.stringify(productionItem.ingredients)}jhjhhj */}
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {/* ============ RAW MATERIALS SECTION ============ */}
                                        {(() => {
                                          return (
                                            productionItem.ingredients || []
                                          )
                                            .filter((ing) =>
                                              isMaterialType(
                                                getNormalizedIngredientType(
                                                  ing,
                                                ),
                                              ),
                                            )
                                            .map((ingredient) => {
                                              const ingredientType =
                                                getNormalizedIngredientType(
                                                  ingredient,
                                                );
                                              const amount =
                                                getMaterialLineAmount(
                                                  productionItem,
                                                  ingredient,
                                                );
                                              return (
                                                <tr
                                                  key={`rm-${ingredient.id}`}
                                                  className="bg-orange-50 hover:bg-orange-100"
                                                >
                                                  <td className="px-1 py-2">
                                                    <select
                                                      value={ingredientType}
                                                      onChange={(e) => {
                                                        handleUpdateIngredient(
                                                          productionItem.id,
                                                          ingredient.id,
                                                          "type",
                                                          e.target.value,
                                                        );
                                                        // Keep selected product for material types; clear only for non-material types.
                                                        if (
                                                          !isMaterialType(
                                                            e.target.value,
                                                          )
                                                        ) {
                                                          handleUpdateIngredient(
                                                            productionItem.id,
                                                            ingredient.id,
                                                            "product",
                                                            null,
                                                          );
                                                        }
                                                      }}
                                                      className={`text-xs border rounded px-1 py-0.5 font-medium w-20 ${
                                                        isMaterialType(
                                                          ingredientType,
                                                        )
                                                          ? "bg-orange-100 text-orange-700 border-orange-200"
                                                          : ingredientType ===
                                                              "by_product_credit"
                                                            ? "bg-blue-100 text-blue-700 border-blue-200"
                                                            : "bg-gray-100 text-gray-700 border-gray-200"
                                                      }`}
                                                    >
                                                      <option value="raw_material">
                                                        Raw Mat.
                                                      </option>
                                                      <option value="semi_finished">
                                                        Semi Fin.
                                                      </option>
                                                      <option value="by_product_credit">
                                                        By-prod.
                                                      </option>
                                                      <option value="other">
                                                        Other
                                                      </option>
                                                    </select>
                                                  </td>

                                                  <td className="px-2 py-2 w-64">
                                                    {isMaterialType(
                                                      ingredientType,
                                                    ) ? (
                                                      <div>
                                                        <Typeahead
                                                          id={`cost-rm-${productionItem.id}-${ingredient.id}`}
                                                          options={
                                                            rawMaterialProducts ||
                                                            []
                                                          }
                                                          labelKey={(product) =>
                                                            `${
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
                                                            ).toFixed(4)}`
                                                          }
                                                          placeholder={
                                                            ingredientType ===
                                                            "semi_finished"
                                                              ? "Select semi finished..."
                                                              : "Select raw material..."
                                                          }
                                                          onChange={(
                                                            selected,
                                                          ) => {
                                                            const selectedProduct =
                                                              selected[0] ||
                                                              null;
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "product",
                                                              selectedProduct,
                                                            );
                                                          }}
                                                          selected={
                                                            ingredient.product
                                                              ? [
                                                                  ingredient.product,
                                                                ]
                                                              : []
                                                          }
                                                          positionFixed
                                                          className="!text-sm"
                                                          inputProps={{
                                                            style: {
                                                              padding:
                                                                "0.25rem 0.5rem",
                                                              fontSize:
                                                                "0.875rem",
                                                              border:
                                                                "1px solid rgb(203 213 225)",
                                                              borderRadius:
                                                                "0.375rem",
                                                            },
                                                          }}
                                                        />
                                                        {/* {JSON.stringify(ingredient.product)} KKNJJK */}
                                                        {ingredient.product && (
                                                          <p className="mt-1 text-xs text-gray-600">
                                                            Available:{" "}
                                                            <span
                                                              className={`font-bold ${
                                                                (ingredient
                                                                  .product
                                                                  .balance ||
                                                                  0) > 0
                                                                  ? "text-green-600"
                                                                  : "text-red-600"
                                                              }`}
                                                            >
                                                              {(() => {
                                                                const value =
                                                                  parseFloat(
                                                                    ingredient
                                                                      .product
                                                                      .balance ||
                                                                      0,
                                                                  );
                                                                const parts =
                                                                  value
                                                                    .toFixed(4)
                                                                    .split(".");
                                                                return `${formatNumber(
                                                                  parts[0],
                                                                )}.${parts[1]}`;
                                                              })()}
                                                            </span>{" "}
                                                            {ingredient.product
                                                              .unit_of_measure ||
                                                              ingredient.product
                                                                .uom ||
                                                              "units"}
                                                          </p>
                                                        )}
                                                      </div>
                                                    ) : (
                                                      <Typeahead
                                                        id={`cost-expense-${productionItem.id}-${ingredient.id}`}
                                                        labelKey={(option) =>
                                                          `${option.code} ${option.name}`
                                                        }
                                                        renderMenuItemChildren={(
                                                          option,
                                                        ) => (
                                                          <div>
                                                            <div>
                                                              <strong>
                                                                {option.code}
                                                              </strong>{" "}
                                                              {option.name}
                                                            </div>
                                                            {option.account_type && (
                                                              <div className="text-xs text-gray-500">
                                                                Type:{" "}
                                                                {
                                                                  option.account_type
                                                                }
                                                              </div>
                                                            )}
                                                          </div>
                                                        )}
                                                        options={
                                                          expenseList || []
                                                        }
                                                        placeholder="Select account..."
                                                        onChange={(
                                                          selectedItems,
                                                        ) => {
                                                          if (
                                                            selectedItems.length >
                                                            0
                                                          ) {
                                                            const expense =
                                                              selectedItems[0];
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "descriptionCode",
                                                              expense.code,
                                                            );
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "account_head",
                                                              expense.name,
                                                            );
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "description",
                                                              expense.name,
                                                            );
                                                          } else {
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "descriptionCode",
                                                              "",
                                                            );
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "account_head",
                                                              "",
                                                            );
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "description",
                                                              "",
                                                            );
                                                          }
                                                        }}
                                                        selected={
                                                          ingredient.descriptionCode &&
                                                          expenseList
                                                            ? expenseList.filter(
                                                                (e) =>
                                                                  e.code ===
                                                                  ingredient.descriptionCode,
                                                              ) || []
                                                            : []
                                                        }
                                                        positionFixed
                                                        className="!text-sm"
                                                        inputProps={{
                                                          style: {
                                                            padding:
                                                              "0.25rem 0.5rem",
                                                            fontSize:
                                                              "0.875rem",
                                                            border:
                                                              "1px solid rgb(203 213 225)",
                                                            borderRadius:
                                                              "0.375rem",
                                                          },
                                                        }}
                                                      />
                                                    )}
                                                  </td>
                                                  {/* Description - For raw materials, show product name */}
                                                  <td className="px-2 py-2 text-sm text-gray-600">
                                                    {ingredientType ===
                                                    "raw_material"
                                                      ? ingredient.product
                                                          ?.item_name || "-"
                                                      : ingredient.description ||
                                                        "-"}
                                                  </td>
                                                  {/* Input Type - For raw materials, show "-" */}
                                                  <td className="px-2 py-2 text-sm text-center text-gray-600">
                                                    -
                                                  </td>
                                                  {/* Rate / Basis + line amount (Actual Qty × Rate ÷ Basis) */}
                                                  <td className="px-2 py-2">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                      <div className="text-center w-full">
                                                        <Input
                                                          type="text"
                                                          inputMode="decimal"
                                                          value={formatJournalStyleQtyInputDisplay(
                                                            resolveMaterialUnitCost(
                                                              ingredient,
                                                            ) ||
                                                              ingredient.unit_cost ||
                                                              ingredient.cost_price ||
                                                              "",
                                                          )}
                                                          onChange={(e) =>
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "unit_cost",
                                                              e.target.value,
                                                            )
                                                          }
                                                          placeholder="0.00"
                                                          className={
                                                            journalAmountInputClassName
                                                          }
                                                        />
                                                      </div>
                                                      <div className="text-center w-full border-t border-gray-100 pt-1.5">
                                                        <p className="text-xs text-gray-600">
                                                          <span className="font-bold text-green-600 tabular-nums">
                                                            {(() => {
                                                              const parts =
                                                                amount
                                                                  .toFixed(2)
                                                                  .split(".");
                                                              return `₦${formatNumber(parts[0])}.${parts[1]}`;
                                                            })()}
                                                          </span>
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  {/* Qty / unit (recipe) + expected batch total — display only */}
                                                  <td className="px-2 py-2">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                      <div className="text-center w-full">
                                                        <p className="text-[10px] uppercase tracking-wide text-gray-500">
                                                          Qty / unit
                                                        </p>
                                                        <p className="text-sm font-semibold text-gray-900 tabular-nums">
                                                          {ingredient.quantity !=
                                                            undefined &&
                                                          ingredient.quantity !=
                                                            null &&
                                                          String(
                                                            ingredient.quantity,
                                                          ).trim() !== ""
                                                            ? (() => {
                                                                const n =
                                                                  parseFloat(
                                                                    ingredient.quantity,
                                                                  );
                                                                return Number.isFinite(
                                                                  n,
                                                                )
                                                                  ? n.toFixed(4)
                                                                  : "—";
                                                              })()
                                                            : "—"}
                                                        </p>
                                                      </div>
                                                      {(() => {
                                                        const savedExp =
                                                          ingredient.expectedQuantity ??
                                                          ingredient.expectedQty ??
                                                          ingredient.expected_qty;
                                                        let expVal = null;
                                                        if (
                                                          savedExp !==
                                                            undefined &&
                                                          savedExp !== null &&
                                                          String(
                                                            savedExp,
                                                          ).trim() !== ""
                                                        ) {
                                                          const p =
                                                            parseFloat(
                                                              savedExp,
                                                            );
                                                          expVal = Number.isNaN(
                                                            p,
                                                          )
                                                            ? null
                                                            : p;
                                                        } else {
                                                          const d =
                                                            getRecordProductionStyleIngredientExpectedQty(
                                                              productionItem.finishedGoods ||
                                                                [],
                                                              ingredient,
                                                            );
                                                          expVal =
                                                            d != null &&
                                                            !Number.isNaN(
                                                              Number(d),
                                                            )
                                                              ? Number(d)
                                                              : null;
                                                        }
                                                        if (expVal == null)
                                                          return null;
                                                        const parts = expVal
                                                          .toFixed(4)
                                                          .split(".");
                                                        return (
                                                          <div className="text-center w-full border-t border-gray-100 pt-1.5">
                                                            <p className="text-[10px] uppercase tracking-wide text-gray-500">
                                                              Expected qty
                                                            </p>
                                                            <p className="text-xs text-gray-600">
                                                              <span className="font-bold text-green-600">
                                                                {formatNumber(
                                                                  parts[0],
                                                                )}
                                                                .{parts[1]}
                                                              </span>
                                                            </p>
                                                          </div>
                                                        );
                                                      })()}
                                                    </div>
                                                  </td>
                                                  <td className="px-2 py-2">
                                                    <div>
                                                      <Input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={(() => {
                                                          const saved =
                                                            getStoredMaterialActualQtyRaw(
                                                              ingredient,
                                                            );
                                                          if (
                                                            ingredient.isActualQtyManuallySet
                                                          ) {
                                                            return saved !==
                                                              undefined &&
                                                              saved !== null &&
                                                              String(
                                                                saved,
                                                              ).trim() !== ""
                                                              ? formatJournalStyleQtyInputDisplay(
                                                                  saved,
                                                                )
                                                              : "";
                                                          }
                                                          if (
                                                            saved !==
                                                              undefined &&
                                                            saved !== null &&
                                                            String(
                                                              saved,
                                                            ).trim() !== ""
                                                          ) {
                                                            return formatJournalStyleQtyInputDisplay(
                                                              saved,
                                                            );
                                                          }
                                                          const d =
                                                            getRecordProductionStyleIngredientExpectedQty(
                                                              productionItem.finishedGoods ||
                                                                [],
                                                              ingredient,
                                                            );
                                                          return d != null
                                                            ? formatJournalStyleQtyInputDisplay(
                                                                String(d),
                                                              )
                                                            : "";
                                                        })()}
                                                        onChange={(e) => {
                                                          const value =
                                                            e.target.value;
                                                          const withoutCommas =
                                                            value.replace(
                                                              /,/g,
                                                              "",
                                                            );
                                                          const sanitizedValue =
                                                            filterJournalAmountInput(
                                                              withoutCommas,
                                                            );
                                                          const parts =
                                                            sanitizedValue.split(
                                                              ".",
                                                            );
                                                          const numericValue =
                                                            parts.length > 2
                                                              ? parts[0] +
                                                                "." +
                                                                parts
                                                                  .slice(1)
                                                                  .join("")
                                                              : sanitizedValue;
                                                          const formattedValue =
                                                            formatNumberWithCommas(
                                                              numericValue,
                                                            );
                                                          handleUpdateIngredient(
                                                            productionItem.id,
                                                            ingredient.id,
                                                            "actualQuantity",
                                                            formattedValue ===
                                                              ""
                                                              ? ""
                                                              : formattedValue,
                                                          );
                                                        }}
                                                        placeholder="0.00"
                                                        className="w-full min-w-[5.5rem] text-center text-sm"
                                                        title="Actual quantity used"
                                                      />
                                                      {(() => {
                                                        const vm =
                                                          getMaterialLineVarianceMeta(
                                                            productionItem,
                                                            ingredient,
                                                          );
                                                        if (!vm) return null;
                                                        const cls =
                                                          vm.action === "ok"
                                                            ? "text-green-600"
                                                            : vm.action ===
                                                                "review"
                                                              ? "text-amber-600"
                                                              : "text-red-600";
                                                        const label =
                                                          vm.action === "ok"
                                                            ? "Auto-approve"
                                                            : vm.action ===
                                                                "review"
                                                              ? "Supervisor review"
                                                              : "Reason required";
                                                        return (
                                                          <p className="mt-1 text-xs text-gray-600 text-center">
                                                            Variance:{" "}
                                                            <span
                                                              className={`font-bold ${cls}`}
                                                            >
                                                              {
                                                                vm.variancePercent
                                                              }
                                                              %
                                                            </span>{" "}
                                                            {vm.action ===
                                                            "reason_required" ? (
                                                              <button
                                                                type="button"
                                                                onClick={
                                                                  scrollToIngredientVarianceReason
                                                                }
                                                                className={`font-semibold underline underline-offset-2 hover:opacity-80 ${cls}`}
                                                              >
                                                                ({label} — enter
                                                                below)
                                                              </button>
                                                            ) : (
                                                              <span className="text-gray-500">
                                                                ({label})
                                                              </span>
                                                            )}
                                                          </p>
                                                        );
                                                      })()}
                                                    </div>
                                                  </td>
                                                  {renderProductionBalanceCell(
                                                    costBreakdownBalances.get(
                                                      `rm-${ingredient.id}`,
                                                    ),
                                                  )}
                                                  <td className="px-2 py-2 text-center bg-red-50">
                                                    <button
                                                      onClick={() =>
                                                        handleRemoveIngredient(
                                                          productionItem.id,
                                                          ingredient.id,
                                                        )
                                                      }
                                                      className="text-red-600 hover:text-red-700"
                                                    >
                                                      <Trash2 size={18} />
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            });
                                        })()}

                                        {/* Raw Materials Subtotal for this item */}
                                        {(() => {
                                          const hasMaterials = (
                                            productionItem.ingredients || []
                                          ).some((ing) =>
                                            isMaterialType(
                                              getNormalizedIngredientType(ing),
                                            ),
                                          );
                                          if (!hasMaterials) return null;

                                          const materialLineTotal =
                                            sumMaterialLineAmounts(
                                              productionItem,
                                            );

                                          return (
                                            <tr className="bg-orange-100 font-bold">
                                              <td
                                                colSpan={4}
                                                className="px-2 py-2 text-right text-sm text-orange-800"
                                              >
                                                Subtotal Raw Materials for{" "}
                                                {productionItem
                                                  .finishedGoods?.[0]
                                                  ?.finishedGood?.item_name ||
                                                  productionItem
                                                    .finishedGoods?.[0]
                                                    ?.finishedGood?.name ||
                                                  "Product"}
                                                :
                                              </td>
                                              <td className="px-2 py-2 text-right text-sm text-orange-800">
                                                <span className="font-bold text-green-600 tabular-nums">
                                                  ₦
                                                  {formatNumber1(
                                                    materialLineTotal.toFixed(
                                                      2,
                                                    ),
                                                  )}
                                                </span>
                                              </td>
                                              <td className="px-2 py-2"></td>
                                              <td className="px-2 py-2"></td>
                                              {renderProductionBalanceCell(
                                                costBreakdownBalances.get(
                                                  "subtotal-rm-materials",
                                                ) ||
                                                  costBreakdownBalances.get(
                                                    "subtotal-rm",
                                                  ),
                                                "text-orange-800",
                                              )}
                                              <td className="px-2 py-2 text-center bg-red-50"></td>
                                            </tr>
                                          );
                                        })()}

                                        {/* ============ BY-PRODUCT CREDIT SECTION ============ */}
                                        {(() => {
                                          const rawMaterialsTotal =
                                            sumMaterialLineAmounts(
                                              productionItem,
                                            );
                                          const subtotalRawMaterialsForByProduct =
                                            getRawMaterialsSubtotalAmount(
                                              productionItem,
                                            );

                                          // Get all non-raw-material items for running total calculation
                                          const allNonRawItems = (
                                            productionItem.ingredients || []
                                          ).filter(
                                            (ing) =>
                                              ing.type ===
                                                "by_product_credit" ||
                                              ing.type === "other",
                                          );

                                          // Helper to calculate amount for an item
                                          const getItemAmount = (
                                            ing,
                                            runningTotal,
                                          ) => {
                                            const iType =
                                              ing.other_type || "rate";
                                            if (iType === "rate")
                                              return getOtherRateLineAmount(
                                                productionItem,
                                                ing.rate,
                                              );
                                            if (iType === "percentage") {
                                              const pct = parseFloat(
                                                ing.quantity || 0,
                                              );
                                              const basis =
                                                ing.percentage_basis;
                                              if (basis === "raw_material")
                                                return (
                                                  (pct / 100) *
                                                  rawMaterialsTotal
                                                );
                                              if (basis === "all_items")
                                                // For "all_items", use Subtotal Raw Materials
                                                return (
                                                  (pct / 100) *
                                                  subtotalRawMaterialsForByProduct
                                                );
                                            }
                                            return 0;
                                          };

                                          // Pre-calculate running totals for all non-raw items
                                          const itemRunningTotals = {};
                                          let runningTotal =
                                            subtotalRawMaterialsForByProduct;
                                          allNonRawItems.forEach((ing) => {
                                            itemRunningTotals[ing.id] =
                                              runningTotal;
                                            const amt = getItemAmount(
                                              ing,
                                              runningTotal,
                                            );
                                            if (
                                              ing.type === "by_product_credit"
                                            ) {
                                              runningTotal -= amt;
                                            } else {
                                              runningTotal += amt;
                                            }
                                          });

                                          // Calculate running balance for by-product credits
                                          let byProductRunningBalance =
                                            subtotalRawMaterialsForByProduct;

                                          // Get total finished goods quantity for scaling
                                          const totalFinishedGoodsQty = (
                                            productionItem.finishedGoods || []
                                          ).reduce((sum, fg) => {
                                            if (fg.finishedGood) {
                                              return (
                                                sum + getCostingGoodQuantity(fg)
                                              );
                                            }
                                            return sum;
                                          }, 0);

                                          // Determine scaling factor: prefer Multiplier / Value, otherwise use total finished goods qty
                                          const finishedGoodsForItem =
                                            productionItem.finishedGoods || [];
                                          const primaryFinishedGood =
                                            finishedGoodsForItem.find(
                                              (fg) => fg.finishedGood,
                                            ) || finishedGoodsForItem[0];

                                          let scalingFactor =
                                            finishedGoodsForItem.reduce(
                                              (sum, fg) => {
                                                if (fg.finishedGood) {
                                                  return (
                                                    sum +
                                                    getCostingGoodQuantity(fg)
                                                  );
                                                }
                                                return sum;
                                              },
                                              0,
                                            );

                                          if (primaryFinishedGood) {
                                            let multiplierValue = 1.0;
                                            if (
                                              primaryFinishedGood.multiplier
                                                ?.multiplier_value
                                            ) {
                                              multiplierValue = parseFloat(
                                                primaryFinishedGood.multiplier
                                                  .multiplier_value,
                                              );
                                            } else if (
                                              primaryFinishedGood.multiplierValue
                                            ) {
                                              multiplierValue =
                                                parseFloat(
                                                  primaryFinishedGood.multiplierValue,
                                                ) || 1.0;
                                            }
                                            if (
                                              !Number.isNaN(multiplierValue)
                                            ) {
                                              scalingFactor = multiplierValue;
                                            }
                                          }

                                          return (
                                            productionItem.ingredients || []
                                          )
                                            .filter(
                                              (ing) =>
                                                ing.type ===
                                                "by_product_credit",
                                            )
                                            .map((ingredient) => {
                                              const ingredientType =
                                                ingredient.type;
                                              const inputType =
                                                ingredient.other_type || "rate";
                                              const currentRunningTotal =
                                                itemRunningTotals[
                                                  ingredient.id
                                                ] ||
                                                subtotalRawMaterialsForByProduct;

                                              // Rate lines scale by output qty; percentage uses stored/calculated amount
                                              let calculatedAmount = 0;
                                              if (inputType === "rate") {
                                                calculatedAmount =
                                                  getOtherRateLineAmount(
                                                    productionItem,
                                                    ingredient.rate,
                                                  );
                                              } else if (
                                                ingredient.amount !==
                                                  undefined &&
                                                ingredient.amount !== null
                                              ) {
                                                calculatedAmount = parseFloat(
                                                  ingredient.amount || 0,
                                                );
                                              } else if (
                                                inputType === "percentage"
                                              ) {
                                                const percentage = parseFloat(
                                                  ingredient.quantity || 0,
                                                );
                                                const basis =
                                                  ingredient.percentage_basis;
                                                if (basis === "raw_material") {
                                                  calculatedAmount =
                                                    (percentage / 100) *
                                                    rawMaterialsTotal;
                                                } else if (
                                                  basis === "all_items"
                                                ) {
                                                  // For "all_items", use the current running balance (which includes all items above)
                                                  calculatedAmount =
                                                    (percentage / 100) *
                                                    byProductRunningBalance;
                                                }
                                              }

                                              // Update running balance: subtract this by-product credit amount
                                              byProductRunningBalance -=
                                                calculatedAmount;

                                              return (
                                                <tr
                                                  key={`bp-${ingredient.id}`}
                                                  className="bg-blue-50 hover:bg-blue-100"
                                                >
                                                  {/* Type */}
                                                  <td className="px-1 py-2">
                                                    <select
                                                      value={ingredientType}
                                                      onChange={(e) => {
                                                        const newType =
                                                          e.target.value;
                                                        // Batch update all fields at once
                                                        setRecordDetails(
                                                          (prev) => ({
                                                            ...prev,
                                                            productionItems:
                                                              prev.productionItems.map(
                                                                (item) => {
                                                                  if (
                                                                    item.id ===
                                                                    productionItem.id
                                                                  ) {
                                                                    return {
                                                                      ...item,
                                                                      ingredients:
                                                                        item.ingredients.map(
                                                                          (
                                                                            ing,
                                                                          ) => {
                                                                            if (
                                                                              ing.id ===
                                                                              ingredient.id
                                                                            ) {
                                                                              const updates =
                                                                                {
                                                                                  ...ing,
                                                                                  type: newType,
                                                                                };
                                                                              if (
                                                                                newType ===
                                                                                "raw_material"
                                                                              ) {
                                                                                updates.descriptionCode =
                                                                                  "";
                                                                                updates.description =
                                                                                  "";
                                                                                updates.other_type =
                                                                                  "";
                                                                                updates.percentage_basis =
                                                                                  "";
                                                                              } else if (
                                                                                newType !==
                                                                                ing.type
                                                                              ) {
                                                                                // Initialize other_type if switching to non-raw_material
                                                                                updates.other_type =
                                                                                  updates.other_type ||
                                                                                  "rate";
                                                                              }
                                                                              return updates;
                                                                            }
                                                                            return ing;
                                                                          },
                                                                        ),
                                                                    };
                                                                  }
                                                                  return item;
                                                                },
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      className="text-xs border rounded px-1 py-0.5 font-medium w-20 bg-blue-100 text-blue-700 border-blue-200"
                                                    >
                                                      <option value="raw_material">
                                                        Raw Mat.
                                                      </option>
                                                      <option value="semi_finished">
                                                        Semi Fin.
                                                      </option>
                                                      <option value="by_product_credit">
                                                        By-prod.
                                                      </option>
                                                      <option value="other">
                                                        Other
                                                      </option>
                                                    </select>
                                                  </td>
                                                  {/* Account Head */}
                                                  <td className="px-2 py-2 w-64">
                                                    <Typeahead
                                                      id={`cost-bp-acct-${productionItem.id}-${ingredient.id}`}
                                                      labelKey={(option) =>
                                                        `${option.code} ${option.name}`
                                                      }
                                                      renderMenuItemChildren={(
                                                        option,
                                                      ) => (
                                                        <div>
                                                          <div>
                                                            <strong>
                                                              {option.code}
                                                            </strong>{" "}
                                                            {option.name}
                                                          </div>
                                                          {option.account_type && (
                                                            <div className="text-xs text-gray-500">
                                                              Type:{" "}
                                                              {
                                                                option.account_type
                                                              }
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                      options={
                                                        expenseList || []
                                                      }
                                                      placeholder="Select account..."
                                                      onChange={(
                                                        selectedItems,
                                                      ) => {
                                                        // Batch update all fields at once
                                                        setRecordDetails(
                                                          (prev) => ({
                                                            ...prev,
                                                            productionItems:
                                                              prev.productionItems.map(
                                                                (item) => {
                                                                  if (
                                                                    item.id ===
                                                                    productionItem.id
                                                                  ) {
                                                                    return {
                                                                      ...item,
                                                                      ingredients:
                                                                        item.ingredients.map(
                                                                          (
                                                                            ing,
                                                                          ) => {
                                                                            if (
                                                                              ing.id ===
                                                                              ingredient.id
                                                                            ) {
                                                                              if (
                                                                                selectedItems.length >
                                                                                0
                                                                              ) {
                                                                                const expense =
                                                                                  selectedItems[0];
                                                                                return {
                                                                                  ...ing,
                                                                                  descriptionCode:
                                                                                    expense.code,
                                                                                  account_head:
                                                                                    expense.name,
                                                                                  description:
                                                                                    expense.name,
                                                                                };
                                                                              } else {
                                                                                return {
                                                                                  ...ing,
                                                                                  descriptionCode:
                                                                                    "",
                                                                                  account_head:
                                                                                    "",
                                                                                  description:
                                                                                    "",
                                                                                };
                                                                              }
                                                                            }
                                                                            return ing;
                                                                          },
                                                                        ),
                                                                    };
                                                                  }
                                                                  return item;
                                                                },
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      selected={
                                                        ingredient.descriptionCode &&
                                                        expenseList
                                                          ? expenseList.filter(
                                                              (exp) =>
                                                                exp.code ===
                                                                ingredient.descriptionCode,
                                                            ) || []
                                                          : []
                                                      }
                                                      positionFixed
                                                      className="!text-sm"
                                                      inputProps={{
                                                        style: {
                                                          padding:
                                                            "0.25rem 0.5rem",
                                                          fontSize: "0.875rem",
                                                          border:
                                                            "1px solid rgb(203 213 225)",
                                                          borderRadius:
                                                            "0.375rem",
                                                          minWidth: "140px",
                                                        },
                                                      }}
                                                    />
                                                  </td>
                                                  {/* Description */}
                                                  <td className="px-2 py-2">
                                                    <Input
                                                      type="text"
                                                      value={
                                                        ingredient.description ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        handleUpdateIngredient(
                                                          productionItem.id,
                                                          ingredient.id,
                                                          "description",
                                                          e.target.value,
                                                        )
                                                      }
                                                      placeholder="Description..."
                                                      className="text-sm w-32"
                                                    />
                                                  </td>
                                                  {/* Input Type (Rate/Percentage) */}
                                                  <td className="px-2 py-2">
                                                    <select
                                                      value={inputType}
                                                      onChange={(e) => {
                                                        const newInputType =
                                                          e.target.value;
                                                        // Batch update all fields at once to avoid state race conditions
                                                        setRecordDetails(
                                                          (prev) => ({
                                                            ...prev,
                                                            productionItems:
                                                              prev.productionItems.map(
                                                                (item) => {
                                                                  if (
                                                                    item.id ===
                                                                    productionItem.id
                                                                  ) {
                                                                    return {
                                                                      ...item,
                                                                      ingredients:
                                                                        item.ingredients.map(
                                                                          (
                                                                            ing,
                                                                          ) => {
                                                                            if (
                                                                              ing.id ===
                                                                              ingredient.id
                                                                            ) {
                                                                              return {
                                                                                ...ing,
                                                                                other_type:
                                                                                  newInputType,
                                                                                rate: "",
                                                                                amount:
                                                                                  "",
                                                                                quantity:
                                                                                  "",
                                                                                percentage_basis:
                                                                                  "",
                                                                              };
                                                                            }
                                                                            return ing;
                                                                          },
                                                                        ),
                                                                    };
                                                                  }
                                                                  return item;
                                                                },
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      className="text-xs border rounded px-1 py-1 bg-white w-full"
                                                    >
                                                      <option value="rate">
                                                        Rate
                                                      </option>
                                                      <option value="percentage">
                                                        Percentage
                                                      </option>
                                                    </select>
                                                  </td>
                                                  {/* Percentage Basis OR Rate Value */}
                                                  <td className="px-2 py-2">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                      {inputType ===
                                                      "percentage" ? (
                                                        <select
                                                          value={
                                                            ingredient.percentage_basis ||
                                                            "all_items"
                                                          }
                                                          onChange={(e) =>
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "percentage_basis",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="text-xs border rounded px-1 py-1 bg-white w-full"
                                                        >
                                                          <option value="">
                                                            Select basis...
                                                          </option>
                                                          <option value="raw_material">
                                                            Raw Material Only
                                                          </option>
                                                          <option value="all_items">
                                                            All Items Above
                                                          </option>
                                                        </select>
                                                      ) : (
                                                        <Input
                                                          type="text"
                                                          inputMode="decimal"
                                                          value={formatJournalStyleQtyInputDisplay(
                                                            ingredient.rate ??
                                                              "",
                                                          )}
                                                          onChange={(e) =>
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "rate",
                                                              e.target.value,
                                                            )
                                                          }
                                                          placeholder="0.00"
                                                          className={
                                                            journalAmountInputClassName
                                                          }
                                                        />
                                                      )}
                                                      <div className="text-center w-full border-t border-gray-100 pt-1.5">
                                                        <p className="text-xs text-gray-600">
                                                          <span className="font-bold text-green-600 tabular-nums">
                                                            {(() => {
                                                              const parts =
                                                                calculatedAmount
                                                                  .toFixed(2)
                                                                  .split(".");
                                                              return `₦${formatNumber(parts[0])}.${parts[1]}`;
                                                            })()}
                                                          </span>
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  {/* Percentage OR Amount */}
                                                  <td className="px-2 py-2">
                                                    {inputType ===
                                                    "percentage" ? (
                                                      <Input
                                                        type="number"
                                                        value={
                                                          ingredient.quantity !==
                                                            undefined &&
                                                          ingredient.quantity !==
                                                            null
                                                            ? ingredient.quantity
                                                            : ""
                                                        }
                                                        onChange={(e) => {
                                                          const val =
                                                            parseFloat(
                                                              e.target.value,
                                                            );
                                                          if (val > 100) return;
                                                          handleUpdateIngredient(
                                                            productionItem.id,
                                                            ingredient.id,
                                                            "quantity",
                                                            e.target.value,
                                                          );
                                                        }}
                                                        placeholder="0%"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        className="text-center text-sm w-20"
                                                      />
                                                    ) : (
                                                      <span className="text-center text-sm text-gray-400 block">
                                                        —
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-2 py-2 text-center text-sm text-gray-400">
                                                    —
                                                  </td>
                                                  {renderProductionBalanceCell(
                                                    costBreakdownBalances.get(
                                                      `bp-${ingredient.id}`,
                                                    ),
                                                    "text-blue-700",
                                                    {
                                                      rateAndLineAmount:
                                                        inputType === "rate",
                                                    },
                                                  )}
                                                  {/* Action */}
                                                  <td className="px-2 py-2 text-center bg-red-50">
                                                    <button
                                                      onClick={() =>
                                                        handleRemoveIngredient(
                                                          productionItem.id,
                                                          ingredient.id,
                                                        )
                                                      }
                                                      className="text-red-600 hover:text-red-700"
                                                    >
                                                      <Trash2 size={18} />
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            });
                                        })()}

                                        {/* ============ OTHER COSTS SECTION ============ */}
                                        {(() => {
                                          const rawMaterialsTotal =
                                            sumMaterialLineAmounts(
                                              productionItem,
                                            );
                                          const subtotalRawMaterials =
                                            getRawMaterialsSubtotalAmount(
                                              productionItem,
                                            );

                                          // Get all non-raw-material items for running total calculation
                                          const allNonRawItems = (
                                            productionItem.ingredients || []
                                          ).filter(
                                            (ing) =>
                                              ing.type ===
                                                "by_product_credit" ||
                                              ing.type === "other",
                                          );

                                          // Helper to calculate amount for an item
                                          const getItemAmount = (
                                            ing,
                                            runningTotal,
                                          ) => {
                                            const iType =
                                              ing.other_type || "rate";
                                            if (iType === "rate")
                                              return getOtherRateLineAmount(
                                                productionItem,
                                                ing.rate,
                                              );
                                            if (iType === "percentage") {
                                              const pct = parseFloat(
                                                ing.quantity || 0,
                                              );
                                              const basis =
                                                ing.percentage_basis;
                                              if (basis === "raw_material")
                                                return (
                                                  (pct / 100) *
                                                  rawMaterialsTotal
                                                );
                                              if (basis === "all_items")
                                                return (
                                                  (pct / 100) * runningTotal
                                                );
                                            }
                                            return 0;
                                          };

                                          // Pre-calculate running totals for all non-raw items
                                          const itemRunningTotals = {};
                                          let runningTotal =
                                            subtotalRawMaterials;
                                          allNonRawItems.forEach((ing) => {
                                            itemRunningTotals[ing.id] =
                                              runningTotal;
                                            const amt = getItemAmount(
                                              ing,
                                              runningTotal,
                                            );
                                            if (
                                              ing.type === "by_product_credit"
                                            ) {
                                              runningTotal -= amt;
                                            } else {
                                              runningTotal += amt;
                                            }
                                          });

                                          // Calculate running balance after by-product credits
                                          const byProductCredits = (
                                            productionItem.ingredients || []
                                          ).filter(
                                            (ing) =>
                                              ing.type === "by_product_credit",
                                          );

                                          // Start with subtotalRawMaterials and subtract by-product credits
                                          // Use the same logic as the by-product section display
                                          let balanceAfterByProducts =
                                            subtotalRawMaterials;

                                          byProductCredits.forEach((ing) => {
                                            const inputType =
                                              ing.other_type || "rate";
                                            let calculatedAmount = 0;

                                            // Use stored amount if available (same as by-product section)
                                            if (
                                              ing.amount !== undefined &&
                                              ing.amount !== null
                                            ) {
                                              calculatedAmount = parseFloat(
                                                ing.amount || 0,
                                              );
                                            } else if (inputType === "rate") {
                                              calculatedAmount =
                                                getOtherRateLineAmount(
                                                  productionItem,
                                                  ing.rate,
                                                );
                                            } else if (
                                              inputType === "percentage"
                                            ) {
                                              const pct = parseFloat(
                                                ing.quantity || 0,
                                              );
                                              const basis =
                                                ing.percentage_basis;
                                              if (basis === "raw_material") {
                                                calculatedAmount =
                                                  (pct / 100) *
                                                  rawMaterialsTotal;
                                              } else if (
                                                basis === "all_items"
                                              ) {
                                                // For "all_items", use the current running balance
                                                calculatedAmount =
                                                  (pct / 100) *
                                                  balanceAfterByProducts;
                                              }
                                            }

                                            // Subtract by-product credit from running balance
                                            balanceAfterByProducts -=
                                              calculatedAmount;
                                          });

                                          // Calculate running balance for "Other" costs
                                          // Start with balance after by-product credits, then add each "Other" cost
                                          let otherCostsRunningBalance =
                                            balanceAfterByProducts;

                                          return (
                                            productionItem.ingredients || []
                                          )
                                            .filter(
                                              (ing) => ing.type === "other",
                                            )
                                            .map((ingredient) => {
                                              const ingredientType =
                                                ingredient.type;
                                              const inputType =
                                                ingredient.other_type || "rate";
                                              const currentRunningTotal =
                                                itemRunningTotals[
                                                  ingredient.id
                                                ] || subtotalRawMaterials;

                                              // Rate lines scale by output qty; percentage uses stored/calculated amount
                                              let calculatedAmount = 0;
                                              if (inputType === "rate") {
                                                calculatedAmount =
                                                  getOtherRateLineAmount(
                                                    productionItem,
                                                    ingredient.rate,
                                                  );
                                              } else if (
                                                ingredient.amount !==
                                                  undefined &&
                                                ingredient.amount !== null
                                              ) {
                                                calculatedAmount = parseFloat(
                                                  ingredient.amount || 0,
                                                );
                                              } else if (
                                                inputType === "percentage"
                                              ) {
                                                const percentage = parseFloat(
                                                  ingredient.quantity || 0,
                                                );
                                                const basis =
                                                  ingredient.percentage_basis;
                                                if (basis === "raw_material") {
                                                  calculatedAmount =
                                                    (percentage / 100) *
                                                    rawMaterialsTotal;
                                                } else if (
                                                  basis === "all_items"
                                                ) {
                                                  // For "all_items", use the current running balance (which includes all items above)
                                                  // Example: If running balance is 4,488.05 and percentage is 10%,
                                                  // calculate: 10% of 4,488.05 = 448.805, then add to balance: 4,488.05 + 448.805 = 4,936.855
                                                  calculatedAmount =
                                                    (percentage / 100) *
                                                    otherCostsRunningBalance;
                                                }
                                              }

                                              // Update running balance: add this "Other" cost amount
                                              // Note: calculatedAmount is already the final amount (rate or percentage-based)
                                              // For percentage with "all_items": calculatedAmount = percentage% of previous running balance
                                              // Then: new running balance = previous running balance + calculatedAmount
                                              otherCostsRunningBalance +=
                                                calculatedAmount;

                                              return (
                                                <tr
                                                  key={`oth-${ingredient.id}`}
                                                  className="hover:bg-gray-50"
                                                >
                                                  {/* Type */}
                                                  <td className="px-1 py-2">
                                                    <select
                                                      value={ingredientType}
                                                      onChange={(e) => {
                                                        const newType =
                                                          e.target.value;
                                                        // Batch update all fields at once
                                                        setRecordDetails(
                                                          (prev) => ({
                                                            ...prev,
                                                            productionItems:
                                                              prev.productionItems.map(
                                                                (item) => {
                                                                  if (
                                                                    item.id ===
                                                                    productionItem.id
                                                                  ) {
                                                                    return {
                                                                      ...item,
                                                                      ingredients:
                                                                        item.ingredients.map(
                                                                          (
                                                                            ing,
                                                                          ) => {
                                                                            if (
                                                                              ing.id ===
                                                                              ingredient.id
                                                                            ) {
                                                                              const updates =
                                                                                {
                                                                                  ...ing,
                                                                                  type: newType,
                                                                                };
                                                                              if (
                                                                                newType ===
                                                                                "raw_material"
                                                                              ) {
                                                                                updates.descriptionCode =
                                                                                  "";
                                                                                updates.description =
                                                                                  "";
                                                                                updates.other_type =
                                                                                  "";
                                                                                updates.percentage_basis =
                                                                                  "";
                                                                              } else if (
                                                                                newType !==
                                                                                ing.type
                                                                              ) {
                                                                                updates.other_type =
                                                                                  updates.other_type ||
                                                                                  "rate";
                                                                              }
                                                                              return updates;
                                                                            }
                                                                            return ing;
                                                                          },
                                                                        ),
                                                                    };
                                                                  }
                                                                  return item;
                                                                },
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      className="text-xs border rounded px-1 py-0.5 font-medium w-20 bg-gray-100 text-gray-700 border-gray-200"
                                                    >
                                                      <option value="raw_material">
                                                        Raw Mat.
                                                      </option>
                                                      <option value="semi_finished">
                                                        Semi Fin.
                                                      </option>
                                                      <option value="by_product_credit">
                                                        By-prod.
                                                      </option>
                                                      <option value="other">
                                                        Other
                                                      </option>
                                                    </select>
                                                  </td>
                                                  {/* Account Head */}
                                                  <td className="px-2 py-2 w-64">
                                                    <Typeahead
                                                      id={`cost-oth-acct-${productionItem.id}-${ingredient.id}`}
                                                      labelKey={(option) =>
                                                        `${option.code} ${option.name}`
                                                      }
                                                      renderMenuItemChildren={(
                                                        option,
                                                      ) => (
                                                        <div>
                                                          <div>
                                                            <strong>
                                                              {option.code}
                                                            </strong>{" "}
                                                            {option.name}
                                                          </div>
                                                          {option.account_type && (
                                                            <div className="text-xs text-gray-500">
                                                              Type:{" "}
                                                              {
                                                                option.account_type
                                                              }
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                      options={
                                                        expenseList || []
                                                      }
                                                      placeholder="Select account..."
                                                      onChange={(
                                                        selectedItems,
                                                      ) => {
                                                        // Batch update all fields at once
                                                        setRecordDetails(
                                                          (prev) => ({
                                                            ...prev,
                                                            productionItems:
                                                              prev.productionItems.map(
                                                                (item) => {
                                                                  if (
                                                                    item.id ===
                                                                    productionItem.id
                                                                  ) {
                                                                    return {
                                                                      ...item,
                                                                      ingredients:
                                                                        item.ingredients.map(
                                                                          (
                                                                            ing,
                                                                          ) => {
                                                                            if (
                                                                              ing.id ===
                                                                              ingredient.id
                                                                            ) {
                                                                              if (
                                                                                selectedItems.length >
                                                                                0
                                                                              ) {
                                                                                const expense =
                                                                                  selectedItems[0];
                                                                                return {
                                                                                  ...ing,
                                                                                  descriptionCode:
                                                                                    expense.code,
                                                                                  account_head:
                                                                                    expense.name,
                                                                                  description:
                                                                                    expense.name,
                                                                                };
                                                                              } else {
                                                                                return {
                                                                                  ...ing,
                                                                                  descriptionCode:
                                                                                    "",
                                                                                  account_head:
                                                                                    "",
                                                                                  description:
                                                                                    "",
                                                                                };
                                                                              }
                                                                            }
                                                                            return ing;
                                                                          },
                                                                        ),
                                                                    };
                                                                  }
                                                                  return item;
                                                                },
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      selected={
                                                        ingredient.descriptionCode &&
                                                        expenseList
                                                          ? expenseList.filter(
                                                              (exp) =>
                                                                exp.code ===
                                                                ingredient.descriptionCode,
                                                            ) || []
                                                          : []
                                                      }
                                                      positionFixed
                                                      className="!text-sm"
                                                      inputProps={{
                                                        style: {
                                                          padding:
                                                            "0.25rem 0.5rem",
                                                          fontSize: "0.875rem",
                                                          border:
                                                            "1px solid rgb(203 213 225)",
                                                          borderRadius:
                                                            "0.375rem",
                                                          minWidth: "140px",
                                                        },
                                                      }}
                                                    />
                                                  </td>
                                                  {/* Description */}
                                                  <td className="px-2 py-2">
                                                    <Input
                                                      type="text"
                                                      value={
                                                        ingredient.description ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        handleUpdateIngredient(
                                                          productionItem.id,
                                                          ingredient.id,
                                                          "description",
                                                          e.target.value,
                                                        )
                                                      }
                                                      placeholder="Description..."
                                                      className="text-sm w-32"
                                                    />
                                                  </td>
                                                  {/* Input Type (Rate/Percentage) */}
                                                  <td className="px-2 py-2">
                                                    <select
                                                      value={inputType}
                                                      onChange={(e) => {
                                                        const newInputType =
                                                          e.target.value;
                                                        // Batch update all fields at once to avoid state race conditions
                                                        setRecordDetails(
                                                          (prev) => ({
                                                            ...prev,
                                                            productionItems:
                                                              prev.productionItems.map(
                                                                (item) => {
                                                                  if (
                                                                    item.id ===
                                                                    productionItem.id
                                                                  ) {
                                                                    return {
                                                                      ...item,
                                                                      ingredients:
                                                                        item.ingredients.map(
                                                                          (
                                                                            ing,
                                                                          ) => {
                                                                            if (
                                                                              ing.id ===
                                                                              ingredient.id
                                                                            ) {
                                                                              return {
                                                                                ...ing,
                                                                                other_type:
                                                                                  newInputType,
                                                                                rate: "",
                                                                                amount:
                                                                                  "",
                                                                                quantity:
                                                                                  "",
                                                                                percentage_basis:
                                                                                  "",
                                                                              };
                                                                            }
                                                                            return ing;
                                                                          },
                                                                        ),
                                                                    };
                                                                  }
                                                                  return item;
                                                                },
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      className="text-xs border rounded px-1 py-1 bg-white w-full"
                                                    >
                                                      <option value="rate">
                                                        Rate
                                                      </option>
                                                      <option value="percentage">
                                                        Percentage
                                                      </option>
                                                    </select>
                                                  </td>
                                                  {/* Percentage Basis OR Rate Value */}
                                                  <td className="px-2 py-2">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                      {inputType ===
                                                      "percentage" ? (
                                                        <select
                                                          value={
                                                            ingredient.percentage_basis ||
                                                            "all_items"
                                                          }
                                                          onChange={(e) =>
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "percentage_basis",
                                                              e.target.value,
                                                            )
                                                          }
                                                          className="text-xs border rounded px-1 py-1 bg-white w-full"
                                                        >
                                                          <option value="">
                                                            Select basis...
                                                          </option>
                                                          <option value="raw_material">
                                                            Raw Material Only
                                                          </option>
                                                          <option value="all_items">
                                                            All Items Above
                                                          </option>
                                                        </select>
                                                      ) : (
                                                        <Input
                                                          type="text"
                                                          inputMode="decimal"
                                                          value={formatJournalStyleQtyInputDisplay(
                                                            ingredient.rate ??
                                                              "",
                                                          )}
                                                          onChange={(e) =>
                                                            handleUpdateIngredient(
                                                              productionItem.id,
                                                              ingredient.id,
                                                              "rate",
                                                              e.target.value,
                                                            )
                                                          }
                                                          placeholder="0.00"
                                                          className={
                                                            journalAmountInputClassName
                                                          }
                                                        />
                                                      )}
                                                      <div className="text-center w-full border-t border-gray-100 pt-1.5">
                                                        <p className="text-xs text-gray-600">
                                                          <span className="font-bold text-green-600 tabular-nums">
                                                            {(() => {
                                                              const parts =
                                                                calculatedAmount
                                                                  .toFixed(2)
                                                                  .split(".");
                                                              return `₦${formatNumber(parts[0])}.${parts[1]}`;
                                                            })()}
                                                          </span>
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </td>
                                                  {/* Percentage OR Amount */}
                                                  <td className="px-2 py-2">
                                                    {inputType ===
                                                    "percentage" ? (
                                                      <Input
                                                        type="number"
                                                        value={
                                                          ingredient.quantity !==
                                                            undefined &&
                                                          ingredient.quantity !==
                                                            null
                                                            ? ingredient.quantity
                                                            : ""
                                                        }
                                                        onChange={(e) => {
                                                          const val =
                                                            parseFloat(
                                                              e.target.value,
                                                            );
                                                          if (val > 100) return;
                                                          handleUpdateIngredient(
                                                            productionItem.id,
                                                            ingredient.id,
                                                            "quantity",
                                                            e.target.value,
                                                          );
                                                        }}
                                                        placeholder="0%"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        className="text-center text-sm w-20"
                                                      />
                                                    ) : (
                                                      <span className="text-center text-sm text-gray-400 block">
                                                        —
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-2 py-2 text-center text-sm text-gray-400">
                                                    —
                                                  </td>
                                                  {renderProductionBalanceCell(
                                                    costBreakdownBalances.get(
                                                      `oth-${ingredient.id}`,
                                                    ),
                                                    "text-gray-700",
                                                    {
                                                      rateAndLineAmount:
                                                        inputType === "rate",
                                                    },
                                                  )}
                                                  {/* Action */}
                                                  <td className="px-2 py-2 text-center bg-red-50">
                                                    <button
                                                      onClick={() =>
                                                        handleRemoveIngredient(
                                                          productionItem.id,
                                                          ingredient.id,
                                                        )
                                                      }
                                                      className="text-red-600 hover:text-red-700"
                                                    >
                                                      <Trash2 size={18} />
                                                    </button>
                                                  </td>
                                                </tr>
                                              );
                                            });
                                        })()}

                                        {/* By-product & Other Subtotal */}
                                        {(
                                          productionItem.ingredients || []
                                        ).filter(
                                          (ing) =>
                                            ing.type === "by_product_credit" ||
                                            ing.type === "other",
                                        ).length > 0 &&
                                          (() => {
                                            const rawMaterialsTotal = (
                                              productionItem.ingredients || []
                                            )
                                              .filter(
                                                (ing) =>
                                                  (ing.type ||
                                                    "raw_material") ===
                                                  "raw_material",
                                              )
                                              .reduce(
                                                (sum, ing) =>
                                                  sum +
                                                  parseFloat(
                                                    ing.quantity || 0,
                                                  ) *
                                                    parseFloat(
                                                      ing.unit_cost ||
                                                        ing.cost_price ||
                                                        ing.product
                                                          ?.unit_cost ||
                                                        ing.product
                                                          ?.cost_price ||
                                                        0,
                                                    ),
                                                0,
                                              );

                                            // Get all non-raw-material items for running total calculation
                                            const allNonRawItems = (
                                              productionItem.ingredients || []
                                            ).filter(
                                              (ing) =>
                                                ing.type ===
                                                  "by_product_credit" ||
                                                ing.type === "other",
                                            );

                                            // Helper to calculate amount for an item
                                            const getItemAmount = (
                                              ing,
                                              runningTotal,
                                            ) => {
                                              const iType =
                                                ing.other_type || "rate";
                                              if (iType === "rate")
                                                return getOtherRateLineAmount(
                                                  productionItem,
                                                  ing.rate,
                                                );
                                              if (iType === "percentage") {
                                                const pct = parseFloat(
                                                  ing.quantity || 0,
                                                );
                                                const basis =
                                                  ing.percentage_basis;
                                                if (basis === "raw_material")
                                                  return (
                                                    (pct / 100) *
                                                    rawMaterialsTotal
                                                  );
                                                if (basis === "all_items")
                                                  return (
                                                    (pct / 100) * runningTotal
                                                  );
                                              }
                                              return 0;
                                            };

                                            // Pre-calculate running totals for all non-raw items
                                            const itemRunningTotals = {};
                                            let runningTotal =
                                              rawMaterialsTotal;
                                            allNonRawItems.forEach((ing) => {
                                              itemRunningTotals[ing.id] =
                                                runningTotal;
                                              const amt = getItemAmount(
                                                ing,
                                                runningTotal,
                                              );
                                              if (
                                                ing.type === "by_product_credit"
                                              ) {
                                                runningTotal -= amt;
                                              } else {
                                                runningTotal += amt;
                                              }
                                            });

                                            const otherTotal = (
                                              productionItem.ingredients || []
                                            )
                                              .filter(
                                                (ing) => ing.type === "other",
                                              )
                                              .reduce((sum, ing) => {
                                                const currentRunningTotal =
                                                  itemRunningTotals[ing.id] ||
                                                  rawMaterialsTotal;
                                                return (
                                                  sum +
                                                  getItemAmount(
                                                    ing,
                                                    currentRunningTotal,
                                                  )
                                                );
                                              }, 0);

                                            const byProductTotal = (
                                              productionItem.ingredients || []
                                            )
                                              .filter(
                                                (ing) =>
                                                  ing.type ===
                                                  "by_product_credit",
                                              )
                                              .reduce((sum, ing) => {
                                                const currentRunningTotal =
                                                  itemRunningTotals[ing.id] ||
                                                  rawMaterialsTotal;
                                                return (
                                                  sum +
                                                  getItemAmount(
                                                    ing,
                                                    currentRunningTotal,
                                                  )
                                                );
                                              }, 0);

                                            const subtotal =
                                              otherTotal - byProductTotal;

                                            // Scale subtotal by Multiplier / Value when available,
                                            // otherwise fall back to total finished goods quantity
                                            const finishedGoodsForItem =
                                              productionItem.finishedGoods ||
                                              [];
                                            const primaryFinishedGood =
                                              finishedGoodsForItem.find(
                                                (fg) => fg.finishedGood,
                                              ) || finishedGoodsForItem[0];

                                            let scalingFactor =
                                              finishedGoodsForItem.reduce(
                                                (sum, fg) => {
                                                  if (fg.finishedGood) {
                                                    return (
                                                      sum +
                                                      getNumericQuantity(
                                                        fg.quantity,
                                                      )
                                                    );
                                                  }
                                                  return sum;
                                                },
                                                0,
                                              );

                                            if (primaryFinishedGood) {
                                              let multiplierValue = 1.0;
                                              if (
                                                primaryFinishedGood.multiplier
                                                  ?.multiplier_value
                                              ) {
                                                multiplierValue = parseFloat(
                                                  primaryFinishedGood.multiplier
                                                    .multiplier_value,
                                                );
                                              } else if (
                                                primaryFinishedGood.multiplierValue
                                              ) {
                                                multiplierValue =
                                                  parseFloat(
                                                    primaryFinishedGood.multiplierValue,
                                                  ) || 1.0;
                                              }
                                              if (
                                                !Number.isNaN(multiplierValue)
                                              ) {
                                                scalingFactor = multiplierValue;
                                              }
                                            }

                                            // Subtotal Other Costs row removed as requested
                                            return null;
                                          })()}
                                      </tbody>
                                    </table>
                                    <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
                                      {(() => {
                                        const multiplierDisplay =
                                          getMultiplierBreakdownDisplay(
                                            productionItem,
                                          );
                                        const {
                                          costPerUnit,
                                          totalBatchCost,
                                          goodQty,
                                          splitWasteQty,
                                          outputUnits,
                                        } =
                                          computeProductionCostTotals(
                                            productionItem,
                                          );

                                        return (
                                          <>
                                            {multiplierDisplay && (
                                              <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-100 font-bold px-4 py-2.5 border-t-2 border-purple-200 text-sm text-purple-900">
                                                <span className="text-right flex-1 min-w-0">
                                                  Multiplier / Value (
                                                  {formatNumber(
                                                    (
                                                      multiplierDisplay.outputUnits ??
                                                      multiplierDisplay.goodQty
                                                    ).toFixed(2),
                                                  )}{" "}
                                                  ×{" "}
                                                  {formatNumber(
                                                    multiplierDisplay.multiplierValue.toFixed(
                                                      2,
                                                    ),
                                                  )}{" "}
                                                  ={" "}
                                                  {formatNumber(
                                                    multiplierDisplay.totalUsed.toFixed(
                                                      2,
                                                    ),
                                                  )}
                                                  ) — shared costs allocation:
                                                </span>
                                                <span className="text-right shrink-0">
                                                  <span className="font-bold text-purple-800 tabular-nums text-base">
                                                    ₦
                                                    {formatNumber1(
                                                      multiplierDisplay.batchSharedAmount.toFixed(
                                                        2,
                                                      ),
                                                    )}
                                                  </span>
                                                  <span className="block text-[10px] font-normal text-purple-700 tabular-nums mt-0.5">
                                                    {formatNumber1(
                                                      multiplierDisplay.cumulativeAfterShared.toFixed(
                                                        2,
                                                      ),
                                                    )}
                                                  </span>
                                                </span>
                                              </div>
                                            )}
                                            <div className="flex flex-wrap items-center justify-between gap-3 bg-green-200 font-bold px-4 py-2.5 text-sm text-green-900">
                                              <span className="text-right flex-1">
                                                TOTAL PRODUCTION COST (Batch) —
                                                sum of all line amounts:
                                              </span>
                                              <span className="font-bold text-green-700 tabular-nums text-base shrink-0">
                                                ₦
                                                {formatNumber(
                                                  totalBatchCost.toFixed(2),
                                                )}
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-100 font-bold px-4 py-2.5 text-sm text-blue-800">
                                              <span className="text-right flex-1 min-w-0">
                                                TOTAL PRODUCTION COST PER UNIT
                                                OF (
                                                {productionItem
                                                  .finishedGoods?.[0]
                                                  ?.finishedGood?.item_name ||
                                                  productionItem
                                                    .finishedGoods?.[0]
                                                    ?.finishedGood?.name ||
                                                  "Product"}
                                                ){" "}
                                                {outputUnits > 0
                                                  ? `(batch ÷ ${formatNumber1(outputUnits)} ${
                                                      splitWasteQty > 0
                                                        ? `= good ${formatNumber1(goodQty || 0)} + waste ${formatNumber1(splitWasteQty)}`
                                                        : "units"
                                                    })`
                                                  : ""}
                                                :
                                              </span>
                                              <span className="font-bold text-green-600 tabular-nums text-base shrink-0">
                                                ₦
                                                {formatNumber(
                                                  costPerUnit.toFixed(2),
                                                )}
                                              </span>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Production Item Button */}
                <div className="flex justify-center mt-4">
                  <UIButton
                    onClick={handleAddProductionItem}
                    className="bg-[var(--aa-navy)] hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Production Item
                  </UIButton>
                </div>

              </div>
            ) : (
              <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No production items found for this production record</p>
                </div>
              </div>
            )}

            {renderIngredientVarianceReasonPanel()}

            {/* Account treatment — one line-by-line journal table */}
            {isSelectedRecordJointShared && jointSharedJournalPreview && (
              <SharedCostingJournalPreview preview={jointSharedJournalPreview} />
            )}

            {/* Footer Actions */}
            <div className="mt-6 border-t border-gray-200 bg-white px-6 py-4 flex items-center gap-4 shadow-sm rounded-lg">
              {/* Multiplier summary (read-only for Complete Batch) - Only for joint_shared */}
              {(() => {
                const costingType =
                  selectedRecord?.costing_type ||
                  selectedRecord?.type ||
                  selectedRecord?.costingType;
                const isJointShared = costingType === "joint_shared";
                return isJointShared ? (
                  <div className="hidden md:flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-700">
                        Total Multiplier
                      </span>
                      <span className="text-indigo-700 font-bold">
                        {calculateTotalMultiplier().toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-700">
                        Base Value (₦)
                      </span>
                      <span className="text-gray-800 font-bold">
                        ₦{formatNumber(multiplierBaseValue.toFixed(2))}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-700">
                        Target Value (₦)
                      </span>
                      <span className="text-gray-800 font-bold">
                        ₦{formatNumber(multiplierTargetValue.toFixed(2))}
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Action Buttons - Always on the right */}
              <div className="flex flex-col items-end gap-2 ml-auto w-full max-w-xl">
                {ingredientVarianceScan.hasReasonRequired &&
                  !ingredientVarianceReasonComplete && (
                    <div className="w-full bg-amber-50 border border-amber-300 rounded-lg px-4 py-2.5 text-left text-sm text-amber-900">
                      <p className="font-semibold">
                        Written reason required ({ingredientVarianceReasonLength}
                        /15 characters)
                      </p>
                      <button
                        type="button"
                        onClick={scrollToIngredientVarianceReason}
                        className="mt-1 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950"
                      >
                        Go to Variance explanation section ↑
                      </button>
                    </div>
                  )}
                {(() => {
                  // Only apply multiplier validation for joint_shared costing type
                  const costingType =
                    selectedRecord?.costing_type ||
                    selectedRecord?.type ||
                    selectedRecord?.costingType;
                  const isJointShared = costingType === "joint_shared";

                  const totalMultiplier = calculateTotalMultiplier();
                  const scalingFactor = calculateScalingFactor();
                  // Only check multiplier match for joint_shared, always allow for job_specific
                  const isMultiplierMatch = isJointShared
                    ? Math.abs(totalMultiplier - scalingFactor) <= 0.05
                    : true; // Always allow for job_specific

                  const varianceReasonOk =
                    !ingredientVarianceScan.hasReasonRequired ||
                    ingredientVarianceReasonComplete;
                  const canCompleteBatch =
                    isMultiplierMatch && varianceReasonOk;

                  return (
                    <>
                      {isJointShared && !isMultiplierMatch && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 font-semibold">
                          {(() => {
                            const ex = getSharedCostOutputExample();
                            return (
                              <>
                                ⚠ Total Multiplier ({totalMultiplier.toFixed(2)})
                                does not match saved output (
                                {scalingFactor.toFixed(2)}) — check Good QTY ×
                                Multiplier (e.g. {ex.qty.toFixed(2)} ×{" "}
                                {ex.multiplier.toFixed(2)} ={" "}
                                {ex.output.toFixed(2)}).
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <UIButton
                          onClick={handleCloseDetailsModal}
                          variant="outline"
                          className="px-8 py-3 rounded-lg border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-semibold text-base flex items-center gap-2"
                          size="lg"
                        >
                          <ArrowLeft className="h-5 w-5" />
                          <span>Back</span>
                        </UIButton>
                        <UIButton
                          onClick={handleCompleteBatch}
                          disabled={!canCompleteBatch}
                          className={`px-8 py-3 rounded-lg shadow-lg transition-all duration-200 font-semibold text-base flex items-center gap-2 ${
                            canCompleteBatch
                              ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white hover:shadow-xl transform hover:scale-105"
                              : "bg-gray-400 text-gray-600 cursor-not-allowed opacity-60"
                          }`}
                          size="lg"
                          title={
                            !varianceReasonOk
                              ? "Enter a written reason (15+ characters) for material variance above 5%"
                              : !isMultiplierMatch
                                ? "Total multiplier must match saved output"
                                : ""
                          }
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          <span>Complete Batch</span>
                          {canCompleteBatch && (
                            <Sparkles className="h-4 w-4 opacity-80" />
                          )}
                        </UIButton>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
