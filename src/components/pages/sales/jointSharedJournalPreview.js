import {
  buildTemplateByProductDisplayBreakdown,
  calculateSharedCostAmounts,
  computeTemplateByProductAssociatedCosts,
} from "@/hooks/useTemplateByProduct";

const parseAmt = (v) => {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** @typedef {"shared_pool"|"template_by_product"|"production"|"balancing"} JournalSection */

function pushEntry(rows, entry) {
  const dr = Number((parseFloat(entry.dr) || 0).toFixed(2));
  const cr = Number((parseFloat(entry.cr) || 0).toFixed(2));
  if (dr === 0 && cr === 0) return;
  rows.push({
    section: entry.section || "production",
    account: entry.account || "—",
    description: entry.description || "",
    dr,
    cr,
    productSku: entry.productSku || "",
  });
}

/** Roll penny rounding into the last FG debit (or largest DR) instead of a balancing line. */
function absorbJournalRoundingDiff(rows, diff) {
  if (!Number.isFinite(diff) || Math.abs(diff) < 0.01) return true;

  const tryAdjust = (row) => {
    if (diff > 0 && row.dr > 0) {
      const adjusted = Number((row.dr - diff).toFixed(2));
      if (adjusted > 0) {
        row.dr = adjusted;
        return true;
      }
    }
    if (diff < 0 && row.cr > 0) {
      const adjusted = Number((row.cr + diff).toFixed(2));
      if (adjusted > 0) {
        row.cr = adjusted;
        return true;
      }
    }
    return false;
  };

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].section === "production" && tryAdjust(rows[i])) return true;
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].section === "template_by_product" && tryAdjust(rows[i])) {
      return true;
    }
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (tryAdjust(rows[i])) return true;
  }
  return false;
}

/** Resolve finished-good product from row + catalog (for inventory_account). */
export function resolveFgProductFromCatalog(fg, catalog = []) {
  if (!fg) return null;
  const stored = fg.finishedGood || fg.product || null;
  const sku = String(
    stored?.item_code ||
      stored?.sku ||
      stored?.SKU ||
      fg.sku ||
      fg.productSku ||
      "",
  ).trim();
  const name = String(
    stored?.item_name || stored?.name || fg.productName || fg.item_name || "",
  ).trim();

  if (Array.isArray(catalog) && catalog.length > 0) {
    const match = catalog.find((p) => {
      const pSku = String(p.item_code || p.sku || p.SKU || "").trim();
      if (sku && pSku && sku === pSku) return true;
      const pName = String(p.item_name || p.name || "").trim();
      return Boolean(name && pName && name === pName);
    });
    if (match) return match;
  }

  return stored;
}

export function resolveFgInventoryAccount(fg, catalog = []) {
  const product = resolveFgProductFromCatalog(fg, catalog);
  return String(product?.inventory_account || "").trim();
}

export function resolveFgSku(fg, catalog = []) {
  const product = resolveFgProductFromCatalog(fg, catalog);
  return String(
    product?.item_code || product?.sku || product?.SKU || "",
  ).trim();
}

/**
 * Preview journal (double entry) for joint/shared costing — matches corrected posting rules:
 * - No WIP credit for joint-pool transfer on template by-product
 * - No extra WIP credit for shared by-product scrap vs pool
 * - Shared allocation is embedded in FG inventory debit (not a separate WIP credit)
 * - Template / item other costs: rate × line quantity (not flat rate)
 */
export function buildJointSharedJournalPreview({
  wipCode = "WIP",
  sharedCosts = [],
  sharedCostQtyUse = 1,
  templateByProduct = null,
  productionItems = [],
  finishedGoodCatalog = [],
  getMaterialLineAmount,
  getOtherRateLineAmount,
  getCostingGoodQuantity,
  computeProductionCostTotals,
}) {
  const rows = [];
  const qtyUse = Math.max(parseFloat(sharedCostQtyUse) || 1, 1);
  const hasTemplate =
    templateByProduct &&
    typeof templateByProduct === "object" &&
    (templateByProduct.productSku ||
      templateByProduct.items?.length ||
      templateByProduct.product_sku);

  const scaledSharedCosts = calculateSharedCostAmounts(
    sharedCosts,
    qtyUse,
    parseAmt,
  );

  for (const cost of scaledSharedCosts) {
    const type = cost.type || "raw_material";
    const exact = parseAmt(cost.amount);
    if (exact <= 0 && type !== "raw_material") continue;

    if (type === "raw_material") {
      if (exact <= 0) continue;
      pushEntry(rows, {
        section: "shared_pool",
        account: wipCode,
        description: `${cost.description || cost.rawMaterialName || "Shared RM"} — shared material consumption`,
        dr: 0,
        cr: exact,
      });
      continue;
    }

    if (type === "by_product_credit") {
      if (hasTemplate) continue;
      if (exact <= 0) continue;
      pushEntry(rows, {
        section: "shared_pool",
        account: cost.descriptionCode || cost.description_code || "By-Product",
        description: "Shared by-product / scrap credit",
        dr: exact,
        cr: 0,
      });
      continue;
    }

    if (type === "other") {
      if (exact <= 0) continue;
      pushEntry(rows, {
        section: "shared_pool",
        account: cost.descriptionCode || cost.description_code || "Expense",
        description: cost.description || "Shared manufacturing cost",
        dr: 0,
        cr: exact,
      });
    }
  }

  if (hasTemplate && typeof computeTemplateByProductAssociatedCosts === "function") {
    const items = templateByProduct.items || [];
    const units = Math.max(parseFloat(templateByProduct.units) || 1, 1);
    const associated = computeTemplateByProductAssociatedCosts(
      items,
      units,
      { useStoredActualQty: true },
    );

    for (const item of items) {
      const itemType = item.type || "raw_material";
      if (itemType !== "raw_material" && itemType !== "semi_finished") continue;
      const recipeQty = parseAmt(item.quantity) || 1;
      const actualQty =
        item.actualQty != null && String(item.actualQty).trim() !== ""
          ? parseAmt(item.actualQty)
          : units * recipeQty;
      const unitCost = parseAmt(item.unit_cost ?? item.rate);
      const lineAmt = Number((actualQty * unitCost).toFixed(2));
      if (lineAmt <= 0) continue;
      pushEntry(rows, {
        section: "template_by_product",
        account: wipCode,
        description: `${item.description || item.rawMaterialName || "RM"} — template by-product material`,
        dr: 0,
        cr: lineAmt,
      });
    }

    for (const item of items) {
      const itemType = item.type || "other";
      if (itemType === "raw_material" || itemType === "semi_finished") continue;
      if (itemType === "by_product_credit") continue;
      const inputType = item.other_type || "rate";
      let lineAmt = 0;
      if (inputType === "rate") {
        lineAmt = Number((parseAmt(item.rate) * units).toFixed(2));
      } else if (inputType === "percentage") {
        const pct = parseAmt(item.quantity);
        const basis = item.percentage_basis || "all_items";
        const base =
          basis === "raw_material"
            ? associated.rawMaterialsTotal || 0
            : associated.associatedCosts || 0;
        lineAmt = Number(((pct / 100) * base).toFixed(2));
      }
      if (lineAmt <= 0) continue;
      pushEntry(rows, {
        section: "template_by_product",
        account: item.description_code || item.account_head || "Expense",
        description: item.description || "Template by-product cost",
        dr: 0,
        cr: lineAmt,
      });
    }

    const inventoryTotal = Number(
      buildTemplateByProductDisplayBreakdown(
        items,
        units,
        templateByProduct.unit_cost,
        templateByProduct.selectedProduct,
      ).totalProduction.toFixed(2),
    );
    if (inventoryTotal > 0) {
      pushEntry(rows, {
        section: "template_by_product",
        account:
          templateByProduct.inventory_account ||
          templateByProduct.inventoryAccount ||
          "By-Product Inventory",
        description: `${templateByProduct.productName || templateByProduct.productSku || "By-Product"} — inventory receipt`,
        dr: inventoryTotal,
        cr: 0,
      });
    }
  }

  for (const productionItem of productionItems || []) {
    const ingredients = productionItem.ingredients || [];
    const finishedGoods = (productionItem.finishedGoods || []).filter(
      (fg) => fg?.finishedGood,
    );
    const activeFinishedGoods = finishedGoods.filter(
      (fg) => getCostingGoodQuantity(fg) > 0,
    );
    const { costPerUnit, totalBatchCost } =
      computeProductionCostTotals(productionItem);
    let fgDebitAllocated = 0;

    for (const ing of ingredients) {
      const t = ing.type || "raw_material";
      if (t === "raw_material" || t === "semi_finished") {
        const lineAmt = getMaterialLineAmount(productionItem, ing);
        if (lineAmt <= 0) continue;
        pushEntry(rows, {
          section: "production",
          account: wipCode,
          description: `${ing.product?.item_name || ing.description || "RM"} — direct material consumption`,
          dr: 0,
          cr: lineAmt,
        });
      } else if (t === "other") {
        const lineAmt = getOtherRateLineAmount(productionItem, ing.rate);
        if (lineAmt <= 0) continue;
        pushEntry(rows, {
          section: "production",
          account: ing.description_code || ing.descriptionCode || "Expense",
          description: ing.description || "Direct manufacturing cost",
          dr: 0,
          cr: lineAmt,
        });
      }
    }

    for (let fgIndex = 0; fgIndex < activeFinishedGoods.length; fgIndex += 1) {
      const fg = activeFinishedGoods[fgIndex];
      const goodQty = getCostingGoodQuantity(fg);
      if (goodQty <= 0) continue;
      const isLastFg = fgIndex === activeFinishedGoods.length - 1;
      const lineAmt = isLastFg
        ? Number((totalBatchCost - fgDebitAllocated).toFixed(2))
        : Number((costPerUnit * goodQty).toFixed(2));
      if (!isLastFg) {
        fgDebitAllocated += lineAmt;
      }
      if (lineAmt <= 0) continue;
      const product = resolveFgProductFromCatalog(fg, finishedGoodCatalog);
      const sku = resolveFgSku(fg, finishedGoodCatalog);
      const invAccount = resolveFgInventoryAccount(fg, finishedGoodCatalog);
      pushEntry(rows, {
        section: "production",
        account: invAccount,
        productSku: sku,
        description: `${product?.item_name || product?.name || sku} — finished goods receipt (incl. shared allocation)`,
        dr: lineAmt,
        cr: 0,
      });
    }
  }

  let totalDr = rows.reduce((s, r) => s + r.dr, 0);
  let totalCr = rows.reduce((s, r) => s + r.cr, 0);
  let diff = Number((totalDr - totalCr).toFixed(2));
  if (Math.abs(diff) >= 0.01) {
    if (!absorbJournalRoundingDiff(rows, diff)) {
      pushEntry(rows, {
        section: "balancing",
        account: wipCode,
        description: "Production completion — balancing transfer",
        dr: diff < 0 ? Math.abs(diff) : 0,
        cr: diff > 0 ? diff : 0,
      });
    }
    totalDr = rows.reduce((s, r) => s + r.dr, 0);
    totalCr = rows.reduce((s, r) => s + r.cr, 0);
    diff = Number((totalDr - totalCr).toFixed(2));
    if (Math.abs(diff) >= 0.01 && Math.abs(diff) < 1) {
      absorbJournalRoundingDiff(rows, diff);
      totalDr = rows.reduce((s, r) => s + r.dr, 0);
      totalCr = rows.reduce((s, r) => s + r.cr, 0);
    }
  }

  const finalDr = totalDr;
  const finalCr = totalCr;

  return {
    rows,
    totalDr: Number(finalDr.toFixed(2)),
    totalCr: Number(finalCr.toFixed(2)),
    balanced: Math.abs(finalDr - finalCr) < 0.02,
  };
}

/** SKU → inventory account from production finished goods. */
export function buildFgInventoryAccountLookup(
  productionItems,
  productCatalog = [],
) {
  const bySku = new Map();
  for (const item of productionItems || []) {
    for (const fg of item.finishedGoods || []) {
      const sku = resolveFgSku(fg, productCatalog);
      const acct = resolveFgInventoryAccount(fg, productCatalog);
      if (sku && acct) bySku.set(sku, acct);
    }
  }
  return bySku;
}

function resolveLedgerAccountCode(
  row,
  wipCode,
  fgAccounts,
  productionItems,
  productCatalog,
) {
  const raw = String(row.account || "").trim();
  if (raw && raw !== "FG Inventory" && raw !== "—") return raw;

  const sku = String(row.productSku || "").trim();
  if (sku && fgAccounts.has(sku)) return fgAccounts.get(sku);

  const desc = String(row.description || "");
  const nameMatch = desc.match(/^(.+?)\s*[—-]\s*/);
  const productName = nameMatch?.[1]?.trim();
  if (productName) {
    for (const item of productionItems || []) {
      for (const fg of item.finishedGoods || []) {
        const product = resolveFgProductFromCatalog(fg, productCatalog);
        if (!product) continue;
        const name = String(product.item_name || product.name || "").trim();
        if (!name) continue;
        if (productName === name || productName.includes(name)) {
          const acct = String(product.inventory_account || "").trim();
          if (acct) return acct;
        }
      }
    }
    if (productCatalog?.length) {
      const catalogHit = productCatalog.find((p) => {
        const pName = String(p.item_name || p.name || "").trim();
        return pName && (productName === pName || productName.includes(pName));
      });
      const acct = String(catalogHit?.inventory_account || "").trim();
      if (acct) return acct;
    }
  }

  if (sku && fgAccounts.has(sku)) return fgAccounts.get(sku);
  if (raw && raw !== "—") return raw;
  return String(wipCode).trim();
}

/** Map preview rows to API ledger payload (joint_shared complete batch). */
export function mapJointSharedPreviewToLedgerPayload(
  preview,
  wipCode = "WIP",
  { productionItems = [], productCatalog = [] } = {},
) {
  const rows = preview?.rows || [];
  if (!rows.length) return [];

  const fgAccounts = buildFgInventoryAccountLookup(
    productionItems,
    productCatalog,
  );

  const inferType = (row) => {
    if (row.section === "balancing") return "inventory";
    if ((row.dr || 0) > 0) return "inventory";
    if (String(row.account || "") === String(wipCode)) return "inventory";
    return "expenses";
  };

  const inferRef = (row) => {
    const sku = String(row.productSku || "").trim();
    if (sku) return sku;
    const desc = String(row.description || "");
    const nameMatch = desc.match(/^(.+?)\s*[—-]\s*/);
    if (nameMatch?.[1]) return nameMatch[1].trim();
    return String(row.account || wipCode).trim();
  };

  return rows.map((row) => ({
    account_code: resolveLedgerAccountCode(
      row,
      wipCode,
      fgAccounts,
      productionItems,
      productCatalog,
    ),
    dr: Number((row.dr || 0).toFixed(2)),
    cr: Number((row.cr || 0).toFixed(2)),
    transaction_description: row.description || "",
    type: inferType(row),
    transaction_ref: inferRef(row),
  }));
}
