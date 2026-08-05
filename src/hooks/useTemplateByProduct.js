import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { _fetchApi } from "@/redux/actions/api";
import {
  parseNumberFromFormatted,
  sortBranchesByFirstCreated,
} from "@/utilities";

export const normalizeByProductOption = (p) => ({
  id: p.id,
  name: p.name || p.item_name || "",
  item_name: p.name || p.item_name || "",
  sku: p.sku || p.item_code || "",
  item_code: p.item_code || p.sku || "",
  cost_price: p.cost_price,
  inventory_account: p.inventory_account || "",
  item_type: p.item_type || "By-Product",
});

export const mapTemplateByProductItem = (item) => ({
  id: item.id || Date.now() + Math.random(),
  type: item.type || "raw_material",
  description:
    item.description ||
    item.rawMaterialName ||
    item.raw_material_name ||
    "",
  description_code: item.descriptionCode || item.description_code || "",
  account_head: item.accountHead || item.account_head || "",
  quantity: item.quantity ?? 0,
  raw_material_id: item.rawMaterialId || item.raw_material_id || "",
  raw_material_name: item.rawMaterialName || item.raw_material_name || "",
  raw_material_sku: item.rawMaterialSku || item.raw_material_sku || "",
  other_type: item.otherType || item.other_type || "rate",
  rate: item.rate ?? item.rate_amount ?? item.unit_cost ?? "",
  percentage_basis: item.percentageBasis || item.percentage_basis || "",
  actualQty:
    item.actualQty ?? item.actual_qty ?? item.actualQtyUsed ?? "",
});

const normalizeMaterialName = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

/** Live WIP / inventory quantity for a raw material (checks common API field names). */
export function getRmAvailableQty(product) {
  return (
    parseFloat(
      product?.quantity ??
        product?.qty ??
        product?.available_qty ??
        product?.balance ??
        product?.stock_quantity ??
        0,
    ) || 0
  );
}

/** Resolve a template line to a WIP raw material (by SKU, id, catalog, then name). */
export function resolveRawMaterialProductFromList(
  mapped,
  rawMaterialProducts,
  existingProduct = null,
  rawMaterialCatalog = [],
) {
  if (
    existingProduct &&
    (existingProduct.item_code ||
      existingProduct.sku ||
      existingProduct.item_name ||
      existingProduct.name)
  ) {
    return { product: existingProduct, matchedInWip: true };
  }

  const sku = String(mapped.raw_material_sku || "").trim();
  const id = String(mapped.raw_material_id || "").trim();
  const targetName = normalizeMaterialName(
    mapped.raw_material_name || mapped.description || "",
  );

  const findInWip = (predicate) =>
    (rawMaterialProducts || []).find(predicate);

  if (sku) {
    const bySku = findInWip(
      (rm) =>
        String(rm.item_code || "").trim() === sku ||
        String(rm.sku || "").trim() === sku ||
        String(rm.product_id || "").trim() === sku,
    );
    if (bySku) return { product: bySku, matchedInWip: true };
  }

  if (id) {
    const byId = findInWip(
      (rm) =>
        String(rm.product_id || "").trim() === id ||
        String(rm.id || "").trim() === id ||
        String(rm.item_code || "").trim() === id ||
        String(rm.sku || "").trim() === id,
    );
    if (byId) return { product: byId, matchedInWip: true };

    const inCatalog = (rawMaterialCatalog || []).find(
      (p) =>
        String(p.id || "").trim() === id ||
        String(p.sku || "").trim() === id ||
        String(p.item_code || "").trim() === id,
    );
    if (inCatalog) {
      const catalogSku = String(
        inCatalog.sku || inCatalog.item_code || "",
      ).trim();
      const wipFromCatalog = catalogSku
        ? findInWip(
            (rm) =>
              String(rm.item_code || rm.sku || rm.product_id || "").trim() ===
              catalogSku,
          )
        : null;
      if (wipFromCatalog) {
        return { product: wipFromCatalog, matchedInWip: true };
      }
      return {
        product: {
          id: inCatalog.id,
          product_id: inCatalog.sku || inCatalog.id,
          item_code: inCatalog.sku || inCatalog.item_code || "",
          sku: inCatalog.sku || inCatalog.item_code || "",
          item_name: inCatalog.name || inCatalog.item_name || "",
          name: inCatalog.name || inCatalog.item_name || "",
          unit_of_measure: inCatalog.unit_of_measure || "",
          balance: 0,
          qty: 0,
          cost_price: inCatalog.cost_price,
          unit_cost: inCatalog.cost_price,
          item_type: inCatalog.item_type || "Raw Material",
        },
        matchedInWip: false,
      };
    }
  }

  if (targetName) {
    const byName = findInWip((rm) => {
      const names = [rm.item_name, rm.name]
        .map(normalizeMaterialName)
        .filter(Boolean);
      return names.some(
        (n) =>
          n === targetName ||
          n.includes(targetName) ||
          targetName.includes(n),
      );
    });
    if (byName) return { product: byName, matchedInWip: true };

    const catalogByName = (rawMaterialCatalog || []).find((p) => {
      const names = [p.name, p.item_name]
        .map(normalizeMaterialName)
        .filter(Boolean);
      return names.some(
        (n) =>
          n === targetName ||
          n.includes(targetName) ||
          targetName.includes(n),
      );
    });
    if (catalogByName) {
      const catalogSku = String(
        catalogByName.sku || catalogByName.item_code || "",
      ).trim();
      const wipFromCatalog = catalogSku
        ? findInWip(
            (rm) =>
              String(rm.item_code || rm.sku || rm.product_id || "").trim() ===
              catalogSku,
          )
        : null;
      if (wipFromCatalog) {
        return { product: wipFromCatalog, matchedInWip: true };
      }
      return {
        product: {
          id: catalogByName.id,
          product_id: catalogByName.sku || catalogByName.id,
          item_code: catalogByName.sku || catalogByName.item_code || "",
          sku: catalogByName.sku || catalogByName.item_code || "",
          item_name: catalogByName.name || catalogByName.item_name || "",
          name: catalogByName.name || catalogByName.item_name || "",
          unit_of_measure: catalogByName.unit_of_measure || "",
          balance: 0,
          qty: 0,
          cost_price: catalogByName.cost_price,
          unit_cost: catalogByName.cost_price,
          item_type: catalogByName.item_type || "Raw Material",
        },
        matchedInWip: false,
      };
    }
  }

  const label =
    mapped.description ||
    mapped.raw_material_name ||
    mapped.raw_material_sku ||
    "";
  if (!label) return { product: null, matchedInWip: false };

  return {
    product: {
      id: mapped.raw_material_id || sku || label,
      product_id: mapped.raw_material_id || sku || "",
      item_code: sku,
      sku,
      item_name: label,
      name: label,
    },
    matchedInWip: false,
  };
};

export const filterTemplateByProductRawMaterials = (items) =>
  (Array.isArray(items) ? items : []).filter(
    (item) => (item.type || "raw_material") === "raw_material",
  );

export const filterTemplateByProductOtherLines = (items) =>
  (Array.isArray(items) ? items : []).filter((item) => {
    const t = item.type || "raw_material";
    return t === "other" || t === "by_product_credit";
  });

/** Build other-line amounts at a given by-product qty multiplier. */
function buildTemplateByProductOtherLines(
  items,
  templateByProductQty,
  rawMaterialsTotal,
) {
  const list = Array.isArray(items) ? items : [];
  let runningTotal = rawMaterialsTotal;
  const otherLines = [];

  const units = Math.max(parseFloat(templateByProductQty) || 1, 1);

  for (const item of filterTemplateByProductOtherLines(list)) {
    const costType = item.type || "other";
    const inputType = item.other_type || "rate";
    let amount = 0;
    if (inputType === "rate") {
      amount = parseTemplateLineAmount(item.rate) * units;
    } else if (inputType === "percentage") {
      const pct = parseFloat(item.quantity) || 0;
      const basis = item.percentage_basis || "all_items";
      if (basis === "raw_material") {
        amount = (pct / 100) * rawMaterialsTotal;
      } else {
        amount = (pct / 100) * runningTotal;
      }
    }
    otherLines.push({ item, amount });
    if (costType === "by_product_credit") {
      runningTotal -= amount;
    } else {
      runningTotal += amount;
    }
  }

  return { otherLines, associatedCosts: Math.max(0, runningTotal) };
}

/** UI breakdown: per-unit cost, total production (per unit × qty), line details. */
export function buildTemplateByProductDisplayBreakdown(
  items,
  templateByProductQty,
  templateByProductUnitCost = "",
  selectedProduct = null,
) {
  const units = Math.max(parseFloat(templateByProductQty) || 1, 1);
  const headerUnitCost = resolveTemplateByProductHeaderUnitCost(
    templateByProductUnitCost,
    selectedProduct,
  );

  const scaled = computeTemplateByProductAssociatedCosts(
    items,
    templateByProductQty,
  );
  // Per-unit total always at qty=1 recipe (ignores scaled actual qty when header qty changes)
  const perUnitBasis = computeTemplateByProductAssociatedCosts(items, 1, {
    useStoredActualQty: false,
  });
  const { otherLines } = buildTemplateByProductOtherLines(
    items,
    templateByProductQty,
    scaled.rawMaterialsTotal,
  );

  const inventoryReceiptPerUnit = headerUnitCost;
  const inventoryReceiptTotal = units * headerUnitCost;
  const associatedCostTotal = scaled.associatedCosts + inventoryReceiptTotal;
  const associatedCostPerUnit =
    units > 0
      ? Number((associatedCostTotal / units).toFixed(2))
      : perUnitBasis.associatedCosts + headerUnitCost;

  return {
    units,
    rawMaterialsTotal: scaled.rawMaterialsTotal,
    otherLines,
    associatedCosts: scaled.associatedCosts,
    headerTotal: inventoryReceiptTotal,
    headerUnitCost,
    associatedBuildPerUnit: associatedCostPerUnit,
    costPerUnit: associatedCostPerUnit,
    totalProduction: associatedCostTotal,
    total: associatedCostTotal,
    inventoryReceiptPerUnit,
    inventoryReceiptTotal,
  };
}

/** API payload row — all types (raw_material, other, by_product_credit). */
export const mapTemplateByProductItemToPayload = (item) => {
  const costType = item.type || "raw_material";
  const rateVal = item.rate || "";
  const unitCostVal = rateVal
    ? parseFloat(String(rateVal).replace(/,/g, "")) || 0
    : undefined;
  return {
    id: item.id,
    type: costType,
    description: item.description || "",
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
    otherType: item.other_type || "rate",
    rate: rateVal,
    ...(unitCostVal !== undefined && { unit_cost: unitCostVal }),
    percentageBasis: item.percentage_basis || "",
    actualQty: item.actualQty ?? "",
  };
};

const parseTemplateLineAmount = (value) =>
  parseFloat(String(value ?? "").replace(/,/g, "")) || 0;

/** Header unit cost for by-product row — stored value or product default cost_price. */
export function resolveTemplateByProductHeaderUnitCost(
  unitCostStr,
  selectedProduct,
) {
  const parsed = parseTemplateLineAmount(unitCostStr);
  if (parsed > 0) return parsed;
  return parseTemplateLineAmount(selectedProduct?.cost_price);
}

/** Raw materials + other costs − by-product credits on template lines. */
export function computeTemplateByProductAssociatedCosts(
  items,
  templateByProductQty,
  { useStoredActualQty = true } = {},
) {
  const units = Math.max(parseFloat(templateByProductQty) || 1, 1);
  const list = Array.isArray(items) ? items : [];

  let rawMaterialsTotal = 0;
  for (const item of filterTemplateByProductRawMaterials(list)) {
    const rawMaterialQty = parseFloat(item.quantity) || 0;
    const qtyUsed = units * rawMaterialQty;
    const actualQty =
      useStoredActualQty &&
      item.actualQty !== undefined &&
      item.actualQty !== null &&
      item.actualQty !== ""
        ? parseFloat(parseNumberFromFormatted(String(item.actualQty))) || 0
        : qtyUsed;
    const unitCost = parseTemplateLineAmount(item.rate);
    rawMaterialsTotal += actualQty * unitCost;
  }

  let associatedCosts = rawMaterialsTotal;
  for (const item of list) {
    const costType = item.type || "raw_material";
    if (costType === "raw_material") continue;

    const inputType = item.other_type || "rate";
    let amount = 0;
    if (inputType === "rate") {
      amount = parseTemplateLineAmount(item.rate) * units;
    } else if (inputType === "percentage") {
      const pct = parseFloat(item.quantity) || 0;
      const basis = item.percentage_basis || "all_items";
      if (basis === "raw_material") {
        amount = (pct / 100) * rawMaterialsTotal;
      } else {
        amount = (pct / 100) * associatedCosts;
      }
    }

    if (costType === "by_product_credit") {
      associatedCosts -= amount;
    } else {
      associatedCosts += amount;
    }
  }

  return {
    associatedCosts: Math.max(0, associatedCosts),
    rawMaterialsTotal,
    units,
  };
}

/**
 * Template by-product summary for UI.
 * Associated cost = raw materials + other lines on the template.
 * Header unit cost is used separately for shared-cost credit / inventory receipt.
 */
export function computeTemplateByProductCostSummary(
  items,
  templateByProductQty,
  templateByProductUnitCost = "",
  selectedProduct = null,
) {
  const breakdown = buildTemplateByProductDisplayBreakdown(
    items,
    templateByProductQty,
    templateByProductUnitCost,
    selectedProduct,
  );

  return {
    subtotal: breakdown.associatedCosts,
    associatedCosts: breakdown.associatedCosts,
    headerTotal: breakdown.headerTotal,
    headerUnitCost: breakdown.headerUnitCost,
    costPerUnit: breakdown.costPerUnit,
    totalProduction: breakdown.totalProduction,
    total: breakdown.totalProduction,
    units: breakdown.units,
    unitCostPerUnit: breakdown.costPerUnit,
  };
}

/** Credit against joint/shared pool = template qty × header unit cost only (not RM/other build-up). */
export function getTemplateByProductCreditAmount(
  _items,
  templateByProductQty,
  templateByProductUnitCost = "",
  selectedProduct = null,
) {
  const units = Math.max(
    parseFloat(String(templateByProductQty ?? "").replace(/,/g, "")) || 1,
    1,
  );
  const headerUnitCost = resolveTemplateByProductHeaderUnitCost(
    templateByProductUnitCost,
    selectedProduct,
  );
  return Number((units * headerUnitCost).toFixed(2));
}

/**
 * Joint/shared grand total: raw materials + other − by-product credits − template by-product.
 */
export function getSharedCostRecipeQty(cost) {
  return parseFloat(cost?.expectedQuantity ?? cost?.quantity ?? 0) || 0;
}

export function getSharedCostExpectedTotal(cost, qtyUse = 1) {
  return parseFloat(qtyUse || 1) * getSharedCostRecipeQty(cost);
}

export function getSharedCostActualTotal(cost, qtyUse = 1) {
  if (cost?.actualQty != null && String(cost.actualQty).trim() !== "") {
    return parseFloat(cost.actualQty) || 0;
  }
  return getSharedCostExpectedTotal(cost, qtyUse);
}

/** Sum of actual raw-material input quantities (kg, etc.) for yield %. */
export function sumSharedActualRawMaterialsInputQty(sharedCosts, qtyUse = 1) {
  const safeQtyUse = normalizeSharedCostQtyUse(qtyUse);
  return (sharedCosts || [])
    .filter((c) => (c.type || "raw_material") === "raw_material")
    .reduce(
      (sum, c) => sum + getSharedCostActualTotal(c, safeQtyUse),
      0,
    );
}

/** Sum of recipe (template) raw-material quantities for expected yield. */
export function sumSharedRecipeRawMaterialsInputQty(sharedCosts) {
  return (sharedCosts || [])
    .filter((c) => (c.type || "raw_material") === "raw_material")
    .reduce((sum, c) => sum + getSharedCostRecipeQty(c), 0);
}

export function computeSharedCostActualQty(cost, qtyUse = 1) {
  const recipe = getSharedCostRecipeQty(cost);
  return String((parseFloat(qtyUse || 1) * recipe).toFixed(4));
}

export function normalizeSharedCostQtyUse(qtyUse) {
  const n = parseFloat(qtyUse || 1);
  return Number.isNaN(n) || n <= 0 ? 1 : n;
}

/**
 * Batch scale from raw materials: Σ(actual qty) ÷ Σ(recipe qty).
 * When actual is blank for a line, recipe qty is used for that line (ratio 1).
 * Returns null when no recipe quantities exist.
 */
export function computeSharedCostScaleFromRawMaterials(sharedCosts) {
  const rawMaterials = (sharedCosts || []).filter(
    (c) => (c.type || "raw_material") === "raw_material",
  );

  let totalRecipe = 0;
  let totalActual = 0;

  for (const cost of rawMaterials) {
    const recipe = getSharedCostRecipeQty(cost);
    if (recipe <= 0) continue;
    totalRecipe += recipe;

    const hasActual =
      cost?.actualQty != null && String(cost.actualQty).trim() !== "";
    const actual = hasActual ? parseFloat(cost.actualQty) || 0 : recipe;
    totalActual += actual;
  }

  if (totalRecipe <= 0) return null;
  return parseFloat((totalActual / totalRecipe).toFixed(4));
}

const defaultParseSharedAmount = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

export function sumSharedRecipeRawMaterialsTotal(
  sharedCosts,
  parseAmount = defaultParseSharedAmount,
) {
  return (sharedCosts || [])
    .filter((c) => (c.type || "raw_material") === "raw_material")
    .reduce(
      (sum, c) =>
        sum + getSharedCostRecipeQty(c) * parseAmount(c.unit_cost),
      0,
    );
}

export function sumSharedActualRawMaterialsTotal(
  sharedCosts,
  qtyUse = 1,
  parseAmount = defaultParseSharedAmount,
) {
  const safeQtyUse = normalizeSharedCostQtyUse(qtyUse);
  return (sharedCosts || [])
    .filter((c) => (c.type || "raw_material") === "raw_material")
    .reduce(
      (sum, c) =>
        sum +
        getSharedCostActualTotal(c, safeQtyUse) * parseAmount(c.unit_cost),
      0,
    );
}

/**
 * Hybrid shared-cost line amount:
 * - raw_material: actual qty × unit cost (no output scale)
 * - other rate: template rate × output scale (qtyUse)
 * - % on raw_material: % × actual raw materials total
 * - % on all_items: % × running grand total
 */
export function computeSharedCostLineAmount(
  cost,
  { runningTotal = 0, rawMaterialsTotal = 0, qtyUse = 1 } = {},
  parseAmount = defaultParseSharedAmount,
) {
  const safeQtyUse = normalizeSharedCostQtyUse(qtyUse);
  const costType = cost.type || "raw_material";
  const inputType = cost.other_type || cost.otherType || "rate";

  if (costType === "raw_material") {
    return (
      getSharedCostActualTotal(cost, safeQtyUse) * parseAmount(cost.unit_cost)
    );
  }
  if (inputType === "rate") {
    return parseAmount(cost.rate) * safeQtyUse;
  }
  if (inputType === "percentage") {
    const pct = parseFloat(cost.quantity || 0);
    const basis = cost.percentage_basis || cost.percentageBasis || "all_items";
    if (basis === "raw_material") {
      return (pct / 100) * rawMaterialsTotal;
    }
    if (basis === "all_items") {
      return (pct / 100) * runningTotal;
    }
  }
  return 0;
}

/** Attach computed `amount` to each shared cost line (hybrid scaling). */
export function calculateSharedCostAmounts(
  sharedCosts,
  sharedCostQtyUse = 1,
  parseAmount = defaultParseSharedAmount,
) {
  const safeQtyUse = normalizeSharedCostQtyUse(sharedCostQtyUse);
  const rawMaterialsTotal = sumSharedActualRawMaterialsTotal(
    sharedCosts,
    safeQtyUse,
    parseAmount,
  );
  let runningTotal = rawMaterialsTotal;

  return (sharedCosts || []).map((cost) => {
    const costType = cost.type || "raw_material";
    const amount = computeSharedCostLineAmount(
      cost,
      { runningTotal, rawMaterialsTotal, qtyUse: safeQtyUse },
      parseAmount,
    );
    const updatedCost = { ...cost, amount };
    if (costType === "by_product_credit") {
      runningTotal -= amount;
    } else if (costType !== "raw_material") {
      runningTotal += amount;
    }
    return updatedCost;
  });
}

export function computeSharedCostsGrandTotal(
  sharedCosts,
  sharedCostQtyUse = 1,
  templateByProductDeduction = 0,
  parseAmount = defaultParseSharedAmount,
  templateHandlesByProduct = false,
) {
  const safeQtyUse = normalizeSharedCostQtyUse(sharedCostQtyUse);
  const rawMaterialsTotal = sumSharedActualRawMaterialsTotal(
    sharedCosts,
    safeQtyUse,
    parseAmount,
  );
  const recipeRawMaterialsTotal = sumSharedRecipeRawMaterialsTotal(
    sharedCosts,
    parseAmount,
  );

  const costsWithAmounts = calculateSharedCostAmounts(
    sharedCosts,
    safeQtyUse,
    parseAmount,
  );

  const deduction = Math.max(
    parseFloat(templateByProductDeduction) || 0,
    0,
  );
  const skipInlineByProductCreditLines = templateHandlesByProduct;

  let grandTotal = rawMaterialsTotal;
  costsWithAmounts.forEach((cost) => {
    const costType = cost.type || "raw_material";
    if (costType === "raw_material") return;
    const amount = cost.amount || 0;
    if (costType === "by_product_credit") {
      if (!skipInlineByProductCreditLines) {
        grandTotal -= amount;
      }
    } else {
      grandTotal += amount;
    }
  });

  grandTotal = Math.max(0, grandTotal - deduction);

  return {
    rawMaterialsTotal,
    recipeRawMaterialsTotal,
    grandTotal,
    totalWithQtyUse: grandTotal,
    templateByProductDeduction: deduction,
    qtyUse: safeQtyUse,
  };
}

export function extractTemplateByProductFromRecord(record, parsedData) {
  const tryObj = (o) => {
    if (!o || typeof o !== "object") return null;
    return (
      o.templateByProduct ||
      o.template_by_product ||
      o.TemplateByProduct ||
      null
    );
  };

  let tbp = tryObj(parsedData);
  if (tbp) return tbp;
  if (parsedData?.requestData) {
    tbp = tryObj(parsedData.requestData);
    if (tbp) return tbp;
  }

  let recordData = record?.data ?? record?.recordDetails;
  if (typeof recordData === "string") {
    try {
      recordData = JSON.parse(recordData);
    } catch {
      recordData = null;
    }
  }
  tbp = tryObj(recordData);
  if (tbp) return tbp;
  if (recordData?.requestData) {
    tbp = tryObj(recordData.requestData);
    if (tbp) return tbp;
  }
  return null;
}

export function useTemplateByProduct({
  activeBusiness,
  rawMaterialProducts = [],
  fallbackByProductOptions = [],
}) {
  const [selectedTemplateByProduct, setSelectedTemplateByProduct] =
    useState(null);
  const [templateByProductQty, setTemplateByProductQty] = useState("1");
  const [templateByProductUnitCost, setTemplateByProductUnitCost] =
    useState("");
  const [templateByProductItems, setTemplateByProductItems] = useState([]);
  const [templateByProductOptions, setTemplateByProductOptions] = useState(
    [],
  );
  const [pendingTemplateByProductMeta, setPendingTemplateByProductMeta] =
    useState(null);
  const [branchOptions, setBranchOptions] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [templateByProductBranchId, setTemplateByProductBranchId] =
    useState("");

  const enrichTemplateByProductItem = useCallback(
    (item) => {
      const mapped = mapTemplateByProductItem(item);
      const { product, matchedInWip } = resolveRawMaterialProductFromList(
        mapped,
        rawMaterialProducts,
        item.product,
      );
      const expectedQty = parseFloat(mapped.quantity) || 0;
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
        actualQty: existingActual || String(expectedQty),
      };
    },
    [rawMaterialProducts],
  );

  const resolveTemplateByProductSelection = useCallback(
    (pid, pname, psku, itemCode, options = templateByProductOptions) => {
      const idStr = pid != null && pid !== "" ? String(pid) : "";
      const skuStr = String(psku || itemCode || "")
        .trim()
        .toLowerCase();
      const lists = [
        ...(Array.isArray(options) ? options : []),
        ...fallbackByProductOptions.map(normalizeByProductOption),
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
    },
    [templateByProductOptions, fallbackByProductOptions],
  );

  const clearTemplateByProductState = useCallback(() => {
    setSelectedTemplateByProduct(null);
    setTemplateByProductQty("1");
    setTemplateByProductUnitCost("");
    setTemplateByProductItems([]);
    setPendingTemplateByProductMeta(null);
    setTemplateByProductBranchId("");
  }, []);

  const applyTemplateByProductFromCostingData = useCallback(
    (costingData, defaultUnits) => {
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
          ? String(u)
          : defaultUnits != null && defaultUnits !== ""
            ? String(defaultUnits)
            : "1";
      const unitsNum = Math.max(parseFloat(units) || 1, 1);
      setTemplateByProductQty(units);
      const uc = tbp.unit_cost ?? tbp.unitCost;
      setTemplateByProductUnitCost(uc != null && uc !== "" ? String(uc) : "");
      const tItems = tbp.items || tbp.Items || [];
      setTemplateByProductItems(
        (Array.isArray(tItems) ? tItems : [])
          .map(mapTemplateByProductItem)
          .map((item) => {
            if ((item.type || "raw_material") !== "raw_material") return item;
            const enriched = enrichTemplateByProductItem(item);
            const recipeQty = parseFloat(enriched.quantity) || 0;
            const savedActual =
              item.actualQty !== undefined &&
              item.actualQty !== null &&
              item.actualQty !== ""
                ? String(item.actualQty)
                : "";
            return {
              ...enriched,
              actualQty:
                savedActual || String((unitsNum * recipeQty).toFixed(4)),
            };
          }),
      );
      const brLoc =
        tbp.branchLocationId ??
        tbp.branch_location_id ??
        tbp.branchRowId ??
        tbp.branch_row_id;
      if (brLoc != null && brLoc !== "") {
        setTemplateByProductBranchId(String(brLoc));
      } else {
        setTemplateByProductBranchId("");
      }
    },
    [
      clearTemplateByProductState,
      enrichTemplateByProductItem,
      resolveTemplateByProductSelection,
      templateByProductOptions,
    ],
  );

  const applyTemplateByProductFromRecord = useCallback(
    (record, parsedData, defaultUnits) => {
      const tbp = extractTemplateByProductFromRecord(record, parsedData);
      if (tbp) {
        applyTemplateByProductFromCostingData(
          { templateByProduct: tbp },
          defaultUnits,
        );
      } else {
        clearTemplateByProductState();
      }
    },
    [applyTemplateByProductFromCostingData, clearTemplateByProductState],
  );

  const buildTemplateByProductPayload = useCallback(() => {
    if (!selectedTemplateByProduct) return null;
    const units = parseFloat(
      String(templateByProductQty || "1").replace(/,/g, ""),
    );
    const unitCost = resolveTemplateByProductHeaderUnitCost(
      templateByProductUnitCost,
      selectedTemplateByProduct,
    );
    const branchRow = branchOptions.find(
      (b) => String(b.id) === String(templateByProductBranchId),
    );
    const branchPayload =
      branchRow && templateByProductBranchId
        ? {
            branchLocationId: branchRow.id,
            branch_id: branchRow.branch_id || "",
            branch_name: "for sales",
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
  }, [
    selectedTemplateByProduct,
    templateByProductItems,
    templateByProductQty,
    templateByProductUnitCost,
    branchOptions,
    templateByProductBranchId,
  ]);

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

  const handleAddTemplateByProductRawMaterial = useCallback(() => {
    if (!selectedTemplateByProduct) {
      toast.error("Select a template by-product first");
      return;
    }
    const newItem = enrichTemplateByProductItem({
      id: Date.now(),
      type: "raw_material",
      description: "",
      quantity: 1,
      raw_material_id: "",
      raw_material_sku: "",
      rate: "",
      actualQty: "1",
    });
    setTemplateByProductItems((prev) => [...prev, newItem]);
  }, [enrichTemplateByProductItem, selectedTemplateByProduct]);

  const handleRemoveTemplateByProductItem = useCallback((itemId) => {
    setTemplateByProductItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const handleTemplateByProductItemChange = useCallback(
    (itemId, field, value) => {
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
            const unitCost =
              value.unit_cost ?? value.cost_price ?? updated.rate ?? "";
            if (unitCost !== "" && unitCost != null) {
              updated.rate = String(unitCost);
            }
            if (!updated.quantity || Number(updated.quantity) <= 0) {
              updated.quantity = 1;
            }
            const expected =
              (parseFloat(templateByProductQty) || 1) *
              (parseFloat(updated.quantity) || 1);
            updated.actualQty = String(expected);
          } else if (field === "product" && !value) {
            updated.availableQty = 0;
            updated.isOutOfWipStock = true;
          }
          if (field === "quantity") {
            const qty = parseFloat(value) || 0;
            updated.quantity = qty;
            const expected =
              (parseFloat(templateByProductQty) || 1) * qty;
            updated.actualQty = String(expected);
          }
          if (field === "actualQty") {
            const availableQty = Number(ing.availableQty || 0);
            const enteredQty = Number(parseNumberFromFormatted(value) || 0);
            if (enteredQty > availableQty) {
              toast.error(
                `Actual qty cannot exceed available balance of ${availableQty}`,
              );
              updated.actualQty = String(availableQty);
            } else if (enteredQty < 0) {
              updated.actualQty = "0";
            } else {
              updated.actualQty = String(enteredQty);
            }
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
    },
    [templateByProductQty],
  );

  const formatRmSelectLabel = (product) => {
    if (!product) return "";
    return `${product.item_name || product.name || "N/A"} (${
      product.item_code || product.sku || "N/A"
    }) - ${product.unit_of_measure || "-"} - Avail: ${getRmAvailableQty(product).toFixed(4)}`;
  };

  useEffect(() => {
    if (templateByProductItems.length === 0 || rawMaterialProducts.length === 0) {
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
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (branchOptions.length === 0) return;
    setTemplateByProductBranchId((prev) => {
      const p = String(prev ?? "").trim();
      if (p && branchOptions.some((b) => String(b.id) === p)) return p;
      return String(branchOptions[0].id);
    });
  }, [branchOptions]);

  const templateByProductCostSummary = useMemo(
    () =>
      computeTemplateByProductCostSummary(
        templateByProductItems,
        templateByProductQty,
        templateByProductUnitCost,
        selectedTemplateByProduct,
      ),
    [
      templateByProductItems,
      templateByProductQty,
      templateByProductUnitCost,
      selectedTemplateByProduct,
    ],
  );

  const templateByProductCreditAmount = useMemo(() => {
    if (!selectedTemplateByProduct) return 0;
    return getTemplateByProductCreditAmount(
      templateByProductItems,
      templateByProductQty,
      templateByProductUnitCost,
      selectedTemplateByProduct,
    );
  }, [
    selectedTemplateByProduct,
    templateByProductItems,
    templateByProductQty,
    templateByProductUnitCost,
  ]);

  const handleTemplateByProductQtyChange = useCallback(
    (value) => {
      setTemplateByProductQty(value);
      if (!selectedTemplateByProduct) return;
      const parsed = parseFloat(String(value).replace(/,/g, ""));
      if (!Number.isFinite(parsed) || parsed <= 0) return;
      setTemplateByProductItems((prev) =>
        prev.map((item) => {
          if ((item.type || "raw_material") !== "raw_material") return item;
          const rmQty = parseFloat(item.quantity) || 0;
          return {
            ...item,
            actualQty: String((parsed * rmQty).toFixed(4)),
          };
        }),
      );
    },
    [selectedTemplateByProduct],
  );

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
        selectedTemplateByProduct.name ||
          selectedTemplateByProduct.item_name,
        selectedTemplateByProduct.sku ||
          selectedTemplateByProduct.item_code,
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

  return {
    selectedTemplateByProduct,
    setSelectedTemplateByProduct,
    templateByProductQty,
    setTemplateByProductQty,
    handleTemplateByProductQtyChange,
    templateByProductCostSummary,
    templateByProductCreditAmount,
    templateByProductUnitCost,
    setTemplateByProductUnitCost,
    templateByProductItems,
    setTemplateByProductItems,
    templateByProductOptions,
    branchOptions,
    branchesLoading,
    templateByProductBranchId,
    setTemplateByProductBranchId,
    clearTemplateByProductState,
    applyTemplateByProductFromCostingData,
    applyTemplateByProductFromRecord,
    buildTemplateByProductPayload,
    loadTemplateByProductOptions,
    loadBranches,
    handleAddTemplateByProductRawMaterial,
    handleRemoveTemplateByProductItem,
    handleTemplateByProductItemChange,
    formatRmSelectLabel,
    getRmAvailableQty,
    filterTemplateByProductRawMaterials,
    computeTemplateByProductCostSummary,
    getTemplateByProductCreditAmount,
    computeSharedCostsGrandTotal,
  };
}
