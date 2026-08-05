import { useMemo } from "react";
import { Typeahead } from "react-bootstrap-typeahead";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatNumber1 } from "@/components/router/utilities";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  resolveDefaultBranchLocationId,
} from "@/utilities";
import {
  buildTemplateByProductDisplayBreakdown,
  filterTemplateByProductRawMaterials,
} from "@/hooks/useTemplateByProduct";

const handleNumericInput = (value) => value.replace(/[^0-9.,]/g, "");

const formatRmShortLabel = (product) => {
  if (!product) return "";
  return `${product.item_name || product.name || "N/A"} (${
    product.item_code || product.sku || "N/A"
  })`;
};

const typeaheadCellClass =
  "min-w-0 w-full [&_.rbt-input-main]:min-w-0 [&_.rbt-token]:max-w-full [&_.rbt-token-label]:block [&_.rbt-token-label]:truncate";

const typeLabel = (type) => {
  if (type === "by_product_credit") return "By-prod.";
  if (type === "other") return "Other";
  return "Raw Mat.";
};

const typeBadgeClass = (type, accent = "orange") => {
  if (type === "by_product_credit") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  if (type === "other") return "bg-gray-100 text-gray-700 border-gray-200";
  if (accent === "green") {
    return "bg-green-100 text-green-700 border-green-200";
  }
  return "bg-orange-100 text-orange-700 border-orange-200";
};

const getAccentTheme = (accent, { embedded, suppressEmbeddedTopBorder }) => {
  if (accent === "green") {
    return {
      outerEmbedded:
        suppressEmbeddedTopBorder
          ? ""
          : "border-t border-green-100 mt-4 pt-4",
      outerStandalone:
        "mb-6 border-l-4 border-l-green-400 pl-3 py-1 bg-white rounded-lg border border-green-100 shadow-sm p-4",
      headerWrap: embedded ? "pb-3 mb-3 border-b border-green-100" : "mb-3",
      titleClass: embedded
        ? "text-sm font-bold text-gray-900"
        : "font-semibold text-gray-700 inline-block px-2 py-0.5 rounded bg-green-50",
      hintClass: embedded ? "text-xs text-gray-600 mt-0.5" : "text-sm text-gray-600 mt-1",
      contentPad: embedded ? "" : "border rounded-lg bg-white shadow-sm border-green-200 mt-3",
      contentInnerPad: embedded ? "pt-3" : "p-4",
      productBar: "border border-green-100 rounded-lg bg-green-50/40 mb-3",
      focusRing: "focus:ring-green-500 focus:border-green-500",
      badge: "bg-green-100 text-green-700",
      addBtn:
        "flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold",
      tableWrap: "overflow-x-auto max-w-full min-w-0 border border-green-100 rounded-lg",
      thead: "bg-green-50",
      rowOk: "bg-green-50 hover:bg-green-100",
      subtotalRow: "bg-green-100 font-bold",
      subtotalText: "text-green-800",
    };
  }

  return {
    outerEmbedded: suppressEmbeddedTopBorder ? "" : "border-t border-purple-200",
    outerStandalone:
      "mb-6 border-l-4 border-l-orange-400 pl-3 py-1 bg-white rounded-lg border border-orange-100 shadow-sm p-4",
    headerWrap: embedded
      ? "px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100"
      : "mb-3",
    titleClass: embedded
      ? "font-semibold text-gray-700 inline-block px-2 py-0.5 rounded bg-orange-100/80"
      : "font-semibold text-gray-700 inline-block px-2 py-0.5 rounded bg-orange-50",
    hintClass: "text-sm text-gray-600 mt-1",
    contentPad: embedded
      ? "px-4 pb-4 pt-3"
      : "border rounded-lg bg-white shadow-sm border-orange-200 mt-3",
    contentInnerPad: "",
    productBar: "flex justify-between items-center p-3 border border-orange-100 rounded-lg bg-gray-50 mb-3",
    focusRing: "focus:ring-orange-500 focus:border-orange-500",
    badge: "bg-orange-100 text-orange-700",
    addBtn:
      "flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold",
    tableWrap: "overflow-x-auto max-w-full min-w-0 border border-orange-100 rounded-lg",
    thead: "bg-orange-50",
    rowOk: "bg-orange-50 hover:bg-orange-100",
    subtotalRow: "bg-orange-100 font-bold",
    subtotalText: "text-orange-800",
  };
};

const formatQty4 = (value) => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "—";
  const parts = n.toFixed(4).split(".");
  return `${formatNumber(parts[0])}.${parts[1]}`;
};

/** Amount on first line, cumulative running balance below — single cell. */
const AmountRunningCell = ({
  amount,
  runningBalance,
  className = "",
  textClassName = "text-gray-800",
  prefix = "",
  credit = false,
}) => (
  <td className={`px-2 py-2 text-right tabular-nums align-top ${className}`}>
    <div className={`text-sm font-semibold ${credit ? "text-blue-600" : textClassName}`}>
      {prefix}
      {credit ? "-" : ""}
      {formatNumber1(amount)}
    </div>
    <div className={`text-xs font-bold mt-0.5 ${textClassName}`}>
      {prefix}
      {formatNumber1(runningBalance)}
    </div>
  </td>
);

const byProductName = (bp) => bp?.name || bp?.item_name || "By-Product";

const percentageBasisLabel = (basis) => {
  if (basis === "raw_material") return "Raw Materials";
  if (basis === "all_items") return "All Items Above";
  return basis || "—";
};

export default function TemplateByProductSection({
  embedded = false,
  suppressEmbeddedTopBorder = false,
  accent = "orange",
  showCostBreakdown = false,
  templateByProductOptions,
  selectedTemplateByProduct,
  onSelectByProduct,
  onClear,
  templateByProductQty,
  onQtyChange,
  templateByProductItems,
  rawMaterialProducts,
  formatRmSelectLabel,
  onAddRawMaterial,
  onRemoveItem,
  onItemChange,
  branchOptions = [],
  branchesLoading = false,
  templateByProductBranchId = "",
  onBranchLocationIdChange,
  templateByProductUnitCost = "",
  onUnitCostChange,
}) {
  const breakdown = useMemo(
    () =>
      buildTemplateByProductDisplayBreakdown(
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

  const rawMaterialRows = filterTemplateByProductRawMaterials(
    templateByProductItems,
  );
  const tbpUnits = parseFloat(templateByProductQty) || 1;

  const otherAmountById = useMemo(() => {
    const map = new Map();
    breakdown.otherLines.forEach(({ item, amount }) => {
      map.set(item.id, amount);
    });
    return map;
  }, [breakdown.otherLines]);

  const rawMaterialOptions = useMemo(() => {
    const base = Array.isArray(rawMaterialProducts)
      ? [...rawMaterialProducts]
      : [];
    const seen = new Set(
      base.map((rm) =>
        String(
          rm.id || rm.product_id || rm.item_code || rm.sku || "",
        ).toLowerCase(),
      ),
    );
    rawMaterialRows.forEach((item) => {
      const product = item.product;
      if (!product) return;
      const key = String(
        product.id ||
          product.product_id ||
          product.item_code ||
          product.sku ||
          product.item_name ||
          "",
      ).toLowerCase();
      if (!seen.has(key)) {
        base.push(product);
        seen.add(key);
      }
    });
    return base;
  }, [rawMaterialProducts, rawMaterialRows]);

  const theme = getAccentTheme(accent, { embedded, suppressEmbeddedTopBorder });

  const outerClass = embedded ? theme.outerEmbedded : theme.outerStandalone;

  const sectionTitle = showCostBreakdown
    ? "Template By-Product"
    : "Template By-Product (Raw Materials Only)";

  const sectionHint = showCostBreakdown
    ? "By-product recipe and associated costs from the costing template."
    : "Raw materials for this by-product. Other costs are managed in the costing template.";

  const productBarClass =
    accent === "green"
      ? `flex justify-between items-center p-3 ${theme.productBar}`
      : theme.productBar;

  return (
    <div className={outerClass}>
      <div className={theme.headerWrap}>
        <div className={embedded ? "" : "mb-3"}>
          <h4 className={theme.titleClass}>{sectionTitle}</h4>
          <p className={theme.hintClass}>{sectionHint}</p>
        </div>
        <div className="flex flex-col gap-3 mb-0 sm:flex-row sm:items-start mt-3">
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              By-product
            </label>
            <Typeahead
              id="markup-template-by-product"
              options={templateByProductOptions}
              labelKey={(bp) =>
                `${bp.name || bp.item_name} (${bp.sku || bp.item_code || bp.id})`
              }
              placeholder="Select by-product..."
              onChange={(sel) => onSelectByProduct(sel?.[0] || null)}
              selected={
                selectedTemplateByProduct ? [selectedTemplateByProduct] : []
              }
              clearButton
              className="text-sm"
            />
          </div>
          {(branchesLoading || (branchOptions?.length ?? 0) > 0) && (
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
                    templateByProductBranchId,
                    branchOptions,
                  )}
                  onChange={(e) => onBranchLocationIdChange?.(e.target.value)}
                  className={`w-full h-[38px] px-2 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 ${theme.focusRing} bg-white`}
                >
                  {branchOptions.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.storeName || b.branch_name || b.branch_id || `Warehouse ${b.id}`}
                      {b.state ? ` — ${b.state}` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedTemplateByProduct && (
        <div className={`${theme.contentPad} ${theme.contentInnerPad}`.trim()}>
          <div className={productBarClass}>
            <div className="flex items-center gap-4 flex-1 flex-wrap">
              <div>
                <span className="font-bold text-gray-900 text-base">
                  {selectedTemplateByProduct.name ||
                    selectedTemplateByProduct.item_name}
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
                  Qty:
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={templateByProductQty || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, "");
                    if (val === "" || /^\d*\.?\d*$/.test(val)) {
                      onQtyChange(val);
                    }
                  }}
                  className={`h-8 w-32 px-2 border-2 border-gray-300 rounded focus:ring-2 ${theme.focusRing} text-sm text-right tabular-nums`}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  Unit Cost (₦):
                </label>
                {onUnitCostChange ? (
                  <input
                    type="text"
                    value={formatNumberWithCommas(templateByProductUnitCost || "")}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, "");
                      if (val === "" || /^\d*\.?\d*$/.test(val)) {
                        onUnitCostChange(val);
                      }
                    }}
                    className={`h-8 w-32 px-2 border-2 border-gray-300 rounded focus:ring-2 ${theme.focusRing} text-sm text-right tabular-nums`}
                    placeholder={
                      breakdown.headerUnitCost > 0
                        ? formatNumber1(breakdown.headerUnitCost)
                        : "0.00"
                    }
                  />
                ) : (
                  <span className="h-8 min-w-[8rem] px-3 inline-flex items-center justify-end rounded border border-gray-200 bg-white text-sm font-semibold tabular-nums text-gray-900">
                    {breakdown.headerUnitCost > 0
                      ? formatNumber1(breakdown.headerUnitCost)
                      : "—"}
                  </span>
                )}
              </div>
              {showCostBreakdown && breakdown.costPerUnit > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                    Cost / unit (total):
                  </label>
                  <span className="h-8 min-w-[8rem] px-3 inline-flex items-center justify-end rounded border border-blue-200 bg-blue-50 text-sm font-bold tabular-nums text-blue-800">
                    {formatNumber1(breakdown.costPerUnit)}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClear}
              className="p-2 text-red-600 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors shrink-0"
              title="Remove template by-product"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-2">
            <Badge className={theme.badge}>
              {templateByProductItems.length} line(s)
              {rawMaterialRows.length > 0
                ? ` · ${rawMaterialRows.length} raw material(s)`
                : ""}
            </Badge>
            <button
              type="button"
              onClick={onAddRawMaterial}
              className={theme.addBtn}
            >
              <Plus size={14} />
              Add Raw Material
            </button>
          </div>

          <div className={theme.tableWrap}>
            <table
              className={`w-full divide-y divide-gray-200 ${
                showCostBreakdown ? "table-fixed" : "min-w-full"
              }`}
            >
              {showCostBreakdown && (
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
              )}
              <thead className={theme.thead}>
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
                  {showCostBreakdown ? (
                    <>
                      <th className="px-1 py-2 text-center text-xs font-bold text-gray-700 uppercase w-20">
                        Input
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                        Rate / Basis
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                        Qty / %
                      </th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-gray-700 uppercase leading-tight min-w-[6.5rem]">
                        Amount (₦)
                        <span className="block text-[10px] font-medium text-gray-500 normal-case tracking-normal">
                          Running balance
                        </span>
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                        Qty
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                        Total Qty
                      </th>
                    </>
                  )}
                  <th className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templateByProductItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showCostBreakdown ? 8 : 6}
                      className="px-4 py-8 text-center text-gray-500 text-sm"
                    >
                      No lines yet. Select a costing template or add raw
                      materials.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const bpLabel = byProductName(selectedTemplateByProduct);
                    const rows = [];
                    let runningBalance = 0;

                    const applyRunningDelta = (delta, isCreditLine = false) => {
                      const signed = isCreditLine
                        ? -Math.abs(Number(delta) || 0)
                        : Number(delta) || 0;
                      runningBalance = Number(
                        (runningBalance + signed).toFixed(2),
                      );
                      return runningBalance;
                    };

                    templateByProductItems.forEach((item, itemIdx) => {
                      const costType = item.type || "raw_material";
                      const isRaw = costType === "raw_material";
                      const isCredit = costType === "by_product_credit";
                      const inputType = item.other_type || "rate";

                      if (isRaw) {
                        const rawMaterialQty = parseFloat(item.quantity) || 0;
                        const qtyUsed = tbpUnits * rawMaterialQty;
                        const actualQty = parseFloat(
                          item.actualQty !== undefined &&
                            item.actualQty !== null &&
                            item.actualQty !== ""
                            ? parseNumberFromFormatted(String(item.actualQty))
                            : qtyUsed,
                        );
                        const availableQty = parseFloat(item.availableQty || 0);
                        const isOutOfWipStock = item.isOutOfWipStock === true;
                        const isInsufficient = actualQty > availableQty;
                        const unitCost =
                          parseFloat(String(item.rate || "").replace(/,/g, "")) ||
                          0;
                        const lineAmount = Number(
                          (actualQty * unitCost).toFixed(2),
                        );
                        const lineRunning = showCostBreakdown
                          ? applyRunningDelta(lineAmount)
                          : runningBalance;
                        const product = item.product;
                        const desc =
                          product?.item_name ||
                          product?.name ||
                          item.description ||
                          "";

                        rows.push(
                          <tr
                            key={item.id}
                            className={
                              isOutOfWipStock || isInsufficient
                                ? "bg-red-50 hover:bg-red-100"
                                : theme.rowOk
                            }
                          >
                            <td className="px-1 py-2 align-middle">
                              <span
                                className={`text-xs border rounded px-1 py-0.5 font-medium inline-block ${typeBadgeClass(costType, accent)}`}
                              >
                                {typeLabel(costType)}
                              </span>
                            </td>
                            <td className="px-2 py-2 align-top overflow-hidden">
                              <div className={typeaheadCellClass}>
                              <Typeahead
                                id={`markup-tbp-ingredient-${item.id}`}
                                options={rawMaterialOptions}
                                labelKey={formatRmShortLabel}
                                renderMenuItemChildren={(product) => {
                                  const avail = parseFloat(
                                    product.balance ??
                                      product.quantity ??
                                      product.qty ??
                                      product.available_qty ??
                                      0,
                                  );
                                  return (
                                    <div className="min-w-0">
                                      <div className="truncate">
                                        {formatRmShortLabel(product)}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {product.unit_of_measure ||
                                          product.uom ||
                                          "units"}{" "}
                                        · Avail:{" "}
                                        {Number.isFinite(avail)
                                          ? avail.toFixed(4)
                                          : "0.0000"}
                                      </div>
                                    </div>
                                  );
                                }}
                                placeholder="Select raw material..."
                                onChange={(selected) =>
                                  onItemChange(
                                    item.id,
                                    "product",
                                    selected?.length > 0 ? selected[0] : null,
                                  )
                                }
                                selected={product ? [product] : []}
                                clearButton
                                className="text-sm w-full min-w-0"
                                inputProps={{
                                  className: "truncate",
                                }}
                              />
                              </div>
                              {product && (
                                <p className="mt-1 text-xs text-gray-600">
                                  {isOutOfWipStock ? (
                                    <span className="text-red-700 font-semibold">
                                      Out of WIP Stock
                                    </span>
                                  ) : isInsufficient ? (
                                    <span className="text-red-700 font-semibold">
                                      Total qty ({actualQty.toFixed(4)}) exceeds
                                      Available ({availableQty.toFixed(4)})
                                    </span>
                                  ) : (
                                    <span className="text-green-700 font-semibold">
                                      Available: {availableQty.toFixed(4)}
                                    </span>
                                  )}
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2 align-top overflow-hidden">
                              {showCostBreakdown ? (
                                <span className="text-sm text-gray-600 block truncate">
                                  {desc || "—"}
                                </span>
                              ) : (
                                <Input
                                  type="text"
                                  value={desc}
                                  onChange={(e) =>
                                    onItemChange(
                                      item.id,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Description"
                                  className="text-sm w-full"
                                />
                              )}
                            </td>
                            {showCostBreakdown ? (
                              <>
                                <td className="px-2 py-2 text-center text-gray-400">
                                  —
                                </td>
                                <td className="px-2 py-2 text-center text-sm tabular-nums">
                                  {unitCost > 0
                                    ? formatNumber1(unitCost)
                                    : "—"}
                                </td>
                                <td className="px-2 py-2 text-center">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      item.quantity !== undefined &&
                                      item.quantity !== null &&
                                      item.quantity !== ""
                                        ? formatNumberWithCommas(
                                            String(item.quantity),
                                          )
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const withoutCommas =
                                        e.target.value.replace(/,/g, "");
                                      const sanitized =
                                        handleNumericInput(withoutCommas);
                                      const parts = sanitized.split(".");
                                      const numericValue =
                                        parts.length > 2
                                          ? `${parts[0]}.${parts
                                              .slice(1)
                                              .join("")}`
                                          : sanitized;
                                      onItemChange(
                                        item.id,
                                        "quantity",
                                        numericValue,
                                      );
                                    }}
                                    placeholder="0.0000"
                                    autoFocus={
                                      itemIdx === 0 &&
                                      !parseFloat(item.quantity || 0)
                                    }
                                    className={`text-right text-sm w-full ${
                                      !parseFloat(item.quantity || 0)
                                        ? "border-red-400 bg-red-50 text-red-600 font-semibold"
                                        : ""
                                    }`}
                                  />
                                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                                    Total: {formatQty4(actualQty)}
                                  </p>
                                </td>
                                <AmountRunningCell
                                  amount={lineAmount}
                                  runningBalance={lineRunning}
                                />
                              </>
                            ) : (
                              <>
                                <td className="px-2 py-2 text-center align-middle">
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={
                                      item.quantity !== undefined &&
                                      item.quantity !== null &&
                                      item.quantity !== ""
                                        ? formatNumberWithCommas(
                                            String(item.quantity),
                                          )
                                        : ""
                                    }
                                    onChange={(e) => {
                                      const withoutCommas =
                                        e.target.value.replace(/,/g, "");
                                      const sanitized =
                                        handleNumericInput(withoutCommas);
                                      const parts = sanitized.split(".");
                                      const numericValue =
                                        parts.length > 2
                                          ? `${parts[0]}.${parts
                                              .slice(1)
                                              .join("")}`
                                          : sanitized;
                                      onItemChange(
                                        item.id,
                                        "quantity",
                                        numericValue,
                                      );
                                    }}
                                    placeholder="0.0000"
                                    autoFocus={
                                      itemIdx === 0 &&
                                      !parseFloat(item.quantity || 0)
                                    }
                                    className={`text-right text-sm w-full ${
                                      !parseFloat(item.quantity || 0)
                                        ? "border-red-400 bg-red-50 text-red-600 font-semibold"
                                        : ""
                                    }`}
                                  />
                                </td>
                                <td className="px-2 py-2 text-center align-middle">
                                  <span
                                    className={`text-sm font-semibold tabular-nums ${
                                      isInsufficient
                                        ? "text-red-700"
                                        : availableQty >= actualQty &&
                                            actualQty > 0
                                          ? "text-green-700"
                                          : "text-gray-700"
                                    }`}
                                  >
                                    {formatQty4(actualQty)}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="px-2 py-2 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Remove line"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>,
                        );
                        return;
                      }

                      if (!showCostBreakdown) return;

                      const amount = otherAmountById.get(item.id) || 0;
                      const lineRunning = applyRunningDelta(amount, isCredit);
                      rows.push(
                        <tr
                          key={item.id}
                          className={isCredit ? "bg-sky-50" : "hover:bg-gray-50"}
                        >
                          <td className="px-1 py-2">
                            <span
                              className={`text-xs border rounded px-1 py-0.5 font-medium inline-block ${typeBadgeClass(costType, accent)}`}
                            >
                              {typeLabel(costType)}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-top overflow-hidden text-sm text-gray-800">
                            <span className="block truncate">
                            {item.description_code && (
                              <span className="font-medium">
                                {item.description_code}{" "}
                              </span>
                            )}
                            {item.account_head || item.description || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-top overflow-hidden text-sm text-gray-600">
                            <span className="block truncate">
                            {item.description || item.account_head || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-xs capitalize text-gray-600">
                            {inputType}
                          </td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums">
                            {inputType === "rate"
                              ? formatNumber1(
                                  parseFloat(
                                    String(item.rate || "").replace(/,/g, ""),
                                  ) || 0,
                                )
                              : percentageBasisLabel(item.percentage_basis)}
                          </td>
                          <td className="px-2 py-2 text-center text-sm tabular-nums">
                            {inputType === "percentage"
                              ? `${parseFloat(item.quantity) || 0}%`
                              : inputType === "rate"
                                ? formatQty4(tbpUnits)
                                : "—"}
                          </td>
                          <AmountRunningCell
                            amount={amount}
                            runningBalance={lineRunning}
                            credit={isCredit}
                          />
                          <td className="px-2 py-2 text-center text-gray-300">
                            —
                          </td>
                        </tr>,
                      );
                    });

                    const associatedRunning = runningBalance;

                    if (showCostBreakdown && rawMaterialRows.length > 0) {
                      rows.push(
                        <tr
                          key="tbp-subtotal-rm"
                          className={theme.subtotalRow}
                        >
                          <td
                            colSpan={6}
                            className={`px-2 py-2 text-right text-sm ${theme.subtotalText}`}
                          >
                            Subtotal Raw Materials for {bpLabel}:
                          </td>
                          <AmountRunningCell
                            amount={breakdown.rawMaterialsTotal}
                            runningBalance={associatedRunning}
                            className={theme.subtotalText}
                            textClassName={theme.subtotalText}
                            prefix="₦"
                          />
                          <td />
                        </tr>,
                      );
                    }

                    if (
                      showCostBreakdown &&
                      breakdown.headerUnitCost > 0 &&
                      templateByProductItems.length > 0
                    ) {
                      const unitCostBatchTotal = breakdown.inventoryReceiptTotal;
                      const runningWithUnitCost = Number(
                        (associatedRunning + unitCostBatchTotal).toFixed(2),
                      );
                      rows.push(
                        <tr
                          key="tbp-unit-cost-add"
                          className="bg-sky-50 font-semibold"
                        >
                          <td
                            colSpan={6}
                            className="px-2 py-2 text-right text-sm text-sky-900"
                          >
                            + Unit cost ({bpLabel}) × {formatQty4(breakdown.units)}:
                          </td>
                          <AmountRunningCell
                            amount={unitCostBatchTotal}
                            runningBalance={runningWithUnitCost}
                            textClassName="text-sky-900"
                            prefix="₦"
                          />
                          <td />
                        </tr>,
                      );
                    }

                    if (
                      showCostBreakdown &&
                      (breakdown.costPerUnit > 0 ||
                        breakdown.headerUnitCost > 0)
                    ) {
                      rows.push(
                        <tr key="tbp-total-per-unit" className="bg-blue-100 font-bold">
                          <td
                            colSpan={6}
                            className="px-2 py-2 text-right text-sm text-blue-800"
                          >
                            COST PER UNIT (total ÷ qty):
                          </td>
                          <AmountRunningCell
                            amount={breakdown.costPerUnit}
                            runningBalance={breakdown.totalProduction}
                            textClassName="text-blue-800"
                            prefix="₦"
                          />
                          <td />
                        </tr>,
                        <tr key="tbp-total-batch" className="bg-green-200 font-bold">
                          <td
                            colSpan={6}
                            className="px-2 py-2 text-right text-sm text-green-900"
                          >
                            TOTAL COST (Unit × Qty) =
                          </td>
                          <AmountRunningCell
                            amount={breakdown.totalProduction}
                            runningBalance={breakdown.totalProduction}
                            textClassName="text-green-900"
                            prefix="₦"
                          />
                          <td />
                        </tr>,
                      );
                    }

                    return rows;
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
