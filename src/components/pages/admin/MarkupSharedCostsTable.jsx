/* eslint-disable react/prop-types */
import React, { useMemo } from "react";
import { Trash2, Package } from "lucide-react";
import { Typeahead } from "react-bootstrap-typeahead";
import "react-bootstrap-typeahead/css/Typeahead.css";
import { Input } from "@/components/ui/input";
import {
  formatNumber,
  formatNumberWithCommas,
  parseNumberFromFormatted,
} from "@/utilities";
import {
  computeSharedCostLineAmount,
  computeSharedCostsGrandTotal,
  getSharedCostExpectedTotal,
  getSharedCostRecipeQty,
  getTemplateByProductCreditAmount,
  normalizeSharedCostQtyUse,
  resolveRawMaterialProductFromList,
  resolveTemplateByProductHeaderUnitCost,
  sumSharedActualRawMaterialsInputQty,
  sumSharedActualRawMaterialsTotal,
} from "@/hooks/useTemplateByProduct";

function formatJournalStyleQtyInputDisplay(raw) {
  if (raw === "" || raw === null || raw === undefined) return "";
  const stripped = parseNumberFromFormatted(String(raw).trim());
  if (stripped === "") return "";
  return formatNumberWithCommas(stripped);
}

function parseJournalStyleAmount(raw) {
  const parsed = parseNumberFromFormatted(String(raw ?? "").trim());
  if (parsed === "" || parsed == null) return 0;
  const n = parseFloat(parsed);
  return Number.isFinite(n) ? n : 0;
}

function isMaterialType(type) {
  return type === "raw_material" || type === "semi_finished";
}

function formatQtyParts(value) {
  if (!Number.isFinite(value)) return "—";
  const parts = value.toFixed(4).split(".");
  return `${formatNumber(parts[0])}.${parts[1]}`;
}

/**
 * Shared cost table — mirrors Markup Costing & Pricing joint/shared layout.
 */
export default function MarkupSharedCostsTable({
  sharedCosts,
  qtyUse = 1,
  templateByProduct = null,
  onUpdateCost,
  rawMaterialProducts = [],
  expenseList = [],
  expectedYieldPercent = null,
  outputQty = 0,
}) {
  const safeQtyUse = normalizeSharedCostQtyUse(qtyUse);

  const enrichedCosts = useMemo(() => {
    return (sharedCosts || []).map((cost) => {
      if (!isMaterialType(cost.type || "raw_material")) return cost;
      if (cost.product) return cost;
      const { product } = resolveRawMaterialProductFromList(
        {
          raw_material_sku: cost.rawMaterialSku,
          raw_material_id: cost.rawMaterialId,
          raw_material_name: cost.rawMaterialName || cost.description,
          description: cost.description,
        },
        rawMaterialProducts,
        cost.product,
      );
      return product ? { ...cost, product } : cost;
    });
  }, [sharedCosts, rawMaterialProducts]);

  const templateHandlesByProduct = useMemo(
    () =>
      !!(
        templateByProduct &&
        (templateByProduct.productSku ||
          templateByProduct.product_sku ||
          templateByProduct.items?.length ||
          templateByProduct.selectedTemplateByProduct)
      ),
    [templateByProduct],
  );

  const templateCredit = useMemo(() => {
    if (!templateByProduct) return 0;
    const qty =
      templateByProduct.quantity ??
      templateByProduct.qty ??
      templateByProduct.templateByProductQty ??
      1;
    const unitCost =
      templateByProduct.unit_cost ??
      templateByProduct.unitCost ??
      templateByProduct.templateByProductUnitCost ??
      "";
    return getTemplateByProductCreditAmount([], qty, unitCost, templateByProduct);
  }, [templateByProduct]);

  const sharedCostTotals = useMemo(
    () =>
      computeSharedCostsGrandTotal(
        enrichedCosts,
        safeQtyUse,
        templateCredit,
        parseJournalStyleAmount,
        templateHandlesByProduct,
      ),
    [enrichedCosts, safeQtyUse, templateCredit, templateHandlesByProduct],
  );

  const sharedCostSummaryAmounts = useMemo(() => {
    const grandTotal = sharedCostTotals.grandTotal;
    const byProductTotal = sharedCostTotals.templateByProductDeduction || 0;
    const subtotalBeforeByProduct = grandTotal + byProductTotal;
    const perRecipeUnitSubtotal = subtotalBeforeByProduct / safeQtyUse;
    const totalSharedCostsPerUnit = grandTotal / safeQtyUse;
    const totalSharedCosts = totalSharedCostsPerUnit * safeQtyUse;
    return {
      perRecipeUnitSubtotal,
      totalSharedCostsPerUnit,
      totalSharedCosts,
    };
  }, [sharedCostTotals, safeQtyUse]);

  const yieldMeta = useMemo(() => {
    const rawMaterialQty = sumSharedActualRawMaterialsInputQty(
      enrichedCosts,
      1,
    );
    const actualYield =
      outputQty > 0 && rawMaterialQty > 0
        ? parseFloat(((outputQty / rawMaterialQty) * 100).toFixed(2))
        : null;
    const expected = expectedYieldPercent;
    if (actualYield == null || expected == null || expected <= 0) {
      return { actualYield, expected, variancePp: null, outputAmount: 0 };
    }
    const variancePp = parseFloat((actualYield - expected).toFixed(2));
    const perUnit = sharedCostSummaryAmounts.totalSharedCostsPerUnit;
    const outputAmount =
      perUnit > 0 && actualYield > 0 ? perUnit / actualYield : 0;
    return { actualYield, expected, variancePp, outputAmount };
  }, [
    enrichedCosts,
    outputQty,
    expectedYieldPercent,
    sharedCostSummaryAmounts.totalSharedCostsPerUnit,
  ]);

  const rawMaterialsTotal = useMemo(
    () =>
      sumSharedActualRawMaterialsTotal(
        enrichedCosts,
        safeQtyUse,
        parseJournalStyleAmount,
      ),
    [enrichedCosts, safeQtyUse],
  );

  const itemRunningTotals = useMemo(() => {
    const totals = {};
    let runningTotal = rawMaterialsTotal;
    enrichedCosts.forEach((item) => {
      const itemType = item.type || "raw_material";
      totals[item.id] = runningTotal;
      const amt = computeSharedCostLineAmount(
        item,
        { runningTotal, rawMaterialsTotal, qtyUse: safeQtyUse },
        parseJournalStyleAmount,
      );
      if (isMaterialType(itemType)) {
        /* raw materials already in rawMaterialsTotal */
      } else if (itemType === "by_product_credit") {
        runningTotal -= amt;
      } else {
        runningTotal += amt;
      }
    });
    return totals;
  }, [enrichedCosts, rawMaterialsTotal, safeQtyUse]);

  const getItemAmount = (item) => {
    const runningTotal =
      itemRunningTotals[item.id] ?? rawMaterialsTotal;
    return computeSharedCostLineAmount(
      item,
      { runningTotal, rawMaterialsTotal, qtyUse: safeQtyUse },
      parseJournalStyleAmount,
    );
  };

  return (
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
              Expected / Actual Qty
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
          {!enrichedCosts.length ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No shared costs for this batch</p>
              </td>
            </tr>
          ) : (
            enrichedCosts.map((cost) => {
              const costType = cost.type || "raw_material";
              const inputType = cost.other_type || "rate";
              const calculatedAmount = getItemAmount(cost);
              const uom =
                cost.product?.unit_of_measure ||
                cost.product?.uom ||
                "Kg";

              return (
                <tr
                  key={cost.id}
                  className={
                    isMaterialType(costType)
                      ? "bg-orange-50 hover:bg-orange-100"
                      : costType === "by_product_credit"
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "bg-gray-50 hover:bg-gray-100"
                  }
                >
                  <td className="px-1 py-2 align-top overflow-hidden">
                    <select
                      value={
                        isMaterialType(costType)
                          ? "raw_material"
                          : costType === "by_product_credit"
                            ? "by_product_credit"
                            : "other"
                      }
                      disabled
                      className={`text-xs border rounded px-1 py-0.5 font-medium w-full min-w-0 max-w-full h-9 ${
                        isMaterialType(costType)
                          ? "bg-orange-100 text-orange-700 border-orange-200"
                          : costType === "by_product_credit"
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      <option value="raw_material">Raw Mat.</option>
                      <option value="by_product_credit">By-prod.</option>
                      <option value="other">Other</option>
                    </select>
                  </td>

                  <td className="px-2 py-2 align-top overflow-hidden">
                    {isMaterialType(costType) ? (
                      <div className="min-w-0 w-full">
                        <Typeahead
                          id={`shared-cost-product-${cost.id}`}
                          options={rawMaterialProducts}
                          labelKey={(product) =>
                            `${product.item_name || product.name || "N/A"} (${
                              product.item_code || product.sku || "N/A"
                            })`
                          }
                          placeholder="Select raw material..."
                          selected={cost.product ? [cost.product] : []}
                          disabled
                          clearButton={false}
                          className="text-sm w-full min-w-0"
                          inputProps={{ className: "truncate bg-gray-50" }}
                        />
                        {cost.product && (
                          <p className="mt-1 text-xs text-gray-600">
                            Available:{" "}
                            <span
                              className={`font-bold ${
                                (cost.product.balance || 0) > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatQtyParts(
                                parseFloat(cost.product.balance || 0),
                              )}
                            </span>{" "}
                            {uom}
                          </p>
                        )}
                        {!cost.product && (cost.rawMaterialName || cost.rawMaterialSku) && (
                          <p className="mt-1 text-xs text-gray-600 truncate">
                            {cost.rawMaterialName || cost.description}
                            {cost.rawMaterialSku ? ` (${cost.rawMaterialSku})` : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="min-w-0 w-full">
                        <Typeahead
                          id={`shared-cost-account-${cost.id}`}
                          labelKey={(option) => `${option.code} ${option.name}`}
                          options={expenseList || []}
                          placeholder="Select account..."
                          selected={
                            cost.descriptionCode
                              ? expenseList.filter(
                                  (e) => e.code === cost.descriptionCode,
                                )
                              : []
                          }
                          disabled
                          clearButton={false}
                          className="text-sm w-full min-w-0"
                          inputProps={{ className: "truncate bg-gray-50" }}
                        />
                      </div>
                    )}
                  </td>

                  <td className="px-2 py-2 align-top overflow-hidden">
                    <Input
                      type="text"
                      readOnly
                      value={cost.description || cost.rawMaterialName || ""}
                      className="text-sm w-full min-w-0 bg-white"
                    />
                  </td>

                  <td className="px-1 py-2 align-top overflow-hidden">
                    {isMaterialType(costType) ? (
                      <span className="inline-flex items-center h-9 text-xs text-gray-500">
                        —
                      </span>
                    ) : (
                      <select
                        value={inputType}
                        disabled
                        className="text-xs border rounded px-1 py-0.5 w-full max-w-full min-w-0 h-9 bg-white"
                      >
                        <option value="rate">Rate</option>
                        <option value="percentage">%</option>
                      </select>
                    )}
                  </td>

                  <td className="px-2 py-2 align-top overflow-hidden">
                    {isMaterialType(costType) ? (
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formatJournalStyleQtyInputDisplay(
                          cost.unit_cost ?? "",
                        )}
                        onChange={(e) =>
                          onUpdateCost?.(cost.id, {
                            unit_cost: e.target.value,
                          })
                        }
                        placeholder="0.00"
                        className="w-full min-w-0 text-right text-sm"
                      />
                    ) : inputType === "percentage" ? (
                      <div className="flex flex-col gap-1 w-full min-w-0">
                        <select
                          value={cost.percentage_basis || "all_items"}
                          disabled
                          className="text-xs border rounded px-1 py-0.5 w-full min-w-0 max-w-full h-9 truncate bg-white"
                        >
                          <option value="raw_material">Raw Mat.</option>
                          <option value="all_items">All Above</option>
                        </select>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={formatJournalStyleQtyInputDisplay(
                            cost.quantity ?? "",
                          )}
                          onChange={(e) =>
                            onUpdateCost?.(cost.id, {
                              quantity: e.target.value,
                            })
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
                          onUpdateCost?.(cost.id, { rate: e.target.value })
                        }
                        placeholder="0.00"
                        className="w-full min-w-0 text-right text-sm"
                      />
                    )}
                  </td>

                  <td className="px-2 py-2 align-top overflow-hidden">
                    <div className="flex flex-col gap-1.5 w-full min-w-0 text-xs leading-snug text-gray-600 pt-1.5">
                      {isMaterialType(costType) ? (
                        <>
                          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-1">
                            <span className="text-gray-500">Expected</span>
                            <span className="font-bold text-gray-800 tabular-nums text-right">
                              {formatQtyParts(getSharedCostRecipeQty(cost))}
                            </span>
                            <span className="text-gray-500">{uom}</span>
                          </div>
                          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-x-1">
                            <span className="text-gray-500">Actual</span>
                            {onUpdateCost ? (
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={formatJournalStyleQtyInputDisplay(
                                  cost.actualQty != null &&
                                    String(cost.actualQty).trim() !== ""
                                    ? cost.actualQty
                                    : getSharedCostRecipeQty(cost),
                                )}
                                onChange={(e) =>
                                  onUpdateCost(cost.id, {
                                    actualQty: e.target.value,
                                    isActualQtyManuallySet: true,
                                  })
                                }
                                className="h-7 text-right text-xs font-bold tabular-nums bg-green-50 border-green-300 text-green-800 px-1"
                              />
                            ) : (
                              <span className="font-bold text-green-700 tabular-nums text-right">
                                {formatQtyParts(
                                  getSharedCostExpectedTotal(cost, safeQtyUse),
                                )}
                              </span>
                            )}
                            <span className="text-gray-500">{uom}</span>
                          </div>
                        </>
                      ) : inputType === "percentage" ? (
                        <>
                          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                            <span className="text-gray-500">Expected</span>
                            <span className="font-bold text-gray-800 tabular-nums text-right">
                              {cost.quantity != null &&
                              String(cost.quantity).trim() !== ""
                                ? `${cost.quantity}%`
                                : "—"}
                            </span>
                          </div>
                          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                            <span className="text-gray-500">Actual</span>
                            <span className="font-bold text-gray-400 tabular-nums text-right">
                              —
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                            <span className="text-gray-500">Expected</span>
                            <span className="font-bold text-gray-400 tabular-nums text-right">
                              —
                            </span>
                          </div>
                          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-1">
                            <span className="text-gray-500">Actual</span>
                            <span className="font-bold text-gray-400 tabular-nums text-right">
                              —
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-2 py-2 align-top overflow-hidden text-sm text-right font-semibold text-gray-700 pt-3">
                    {costType === "by_product_credit" ? (
                      <span className="text-blue-600">
                        -{formatNumber(calculatedAmount.toFixed(2))}
                      </span>
                    ) : (
                      formatNumber(calculatedAmount.toFixed(2))
                    )}
                  </td>

                  <td className="px-2 py-2 align-top overflow-hidden text-center pt-2.5">
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center justify-center text-red-300 cursor-not-allowed"
                      title="Line removal is not available in correction"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}

          {enrichedCosts.length > 0 && (
            <tr className="bg-slate-50 font-semibold">
              <td colSpan={6} className="px-2 py-2 text-right text-sm text-slate-800">
                Per recipe unit (subtotal):
              </td>
              <td className="px-2 py-2 text-right text-sm text-slate-800 tabular-nums">
                ₦
                {formatNumber(
                  sharedCostSummaryAmounts.perRecipeUnitSubtotal.toFixed(2),
                )}
              </td>
              <td className="px-2 py-2" />
            </tr>
          )}

          {templateHandlesByProduct && templateCredit > 0 && (
            <tr className="bg-sky-50 font-semibold">
              <td colSpan={6} className="px-2 py-2 text-right text-sm text-sky-900">
                By-Product/Scrap credit
                {(() => {
                  const tbp =
                    templateByProduct?.selectedTemplateByProduct ||
                    templateByProduct;
                  const name = tbp?.item_name || tbp?.name || tbp?.productName || "";
                  const code = String(
                    tbp?.sku || tbp?.item_code || tbp?.productSku || "",
                  ).trim();
                  const qty = Math.max(
                    parseFloat(
                      String(
                        templateByProduct?.templateByProductQty ??
                          templateByProduct?.quantity ??
                          templateByProduct?.qty ??
                          "",
                      ).replace(/,/g, ""),
                    ) || 1,
                    1,
                  );
                  const unitCost = resolveTemplateByProductHeaderUnitCost(
                    templateByProduct?.templateByProductUnitCost ??
                      templateByProduct?.unit_cost ??
                      templateByProduct?.unitCost,
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
                  -{formatNumber(templateCredit.toFixed(2))}
                </span>
              </td>
              <td className="px-2 py-2" />
            </tr>
          )}

          {enrichedCosts.length > 0 && (
            <tr className="bg-indigo-100 font-bold">
              <td colSpan={6} className="px-2 py-2 text-right text-sm text-indigo-800">
                TOTAL SHARED COSTS PER UNIT:
              </td>
              <td className="px-2 py-2 text-right text-sm text-indigo-800 tabular-nums">
                ₦
                {formatNumber(
                  sharedCostSummaryAmounts.totalSharedCostsPerUnit.toFixed(2),
                )}
              </td>
              <td className="px-2 py-2" />
            </tr>
          )}

          {enrichedCosts.length > 0 && (
            <tr className="bg-purple-100 font-bold">
              <td colSpan={6} className="px-2 py-2 text-right text-sm text-purple-800">
                TOTAL SHARED COSTS:
              </td>
              <td className="px-2 py-2 text-right text-sm text-purple-800 tabular-nums">
                ₦
                {formatNumber(
                  sharedCostSummaryAmounts.totalSharedCosts.toFixed(2),
                )}
              </td>
              <td className="px-2 py-2" />
            </tr>
          )}

          {enrichedCosts.length > 0 && (
            <tr className="bg-green-100 font-bold">
              <td colSpan={5} className="px-2 py-2" />
              <td colSpan={1} className="px-2 py-2 text-center text-sm text-green-800">
                <div className="flex items-start justify-center gap-2">
                  {[
                    {
                      label: "Expected (%)",
                      value:
                        yieldMeta.expected == null
                          ? "N/A"
                          : `${yieldMeta.expected.toFixed(2)}%`,
                    },
                    {
                      label: "Actual (%)",
                      value:
                        yieldMeta.actualYield == null
                          ? "N/A"
                          : `${yieldMeta.actualYield.toFixed(2)}%`,
                    },
                    {
                      label: "Variance (%)",
                      value:
                        yieldMeta.variancePp == null
                          ? "N/A"
                          : `${yieldMeta.variancePp >= 0 ? "+" : ""}${yieldMeta.variancePp.toFixed(2)}`,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col items-stretch gap-0.5 min-w-[5.5rem] flex-1"
                    >
                      <span className="text-xs whitespace-nowrap">{label}</span>
                      <Input
                        type="text"
                        readOnly
                        disabled
                        value={value}
                        className="h-8 text-center text-sm font-semibold tabular-nums bg-gray-50 text-gray-800 cursor-not-allowed"
                      />
                    </div>
                  ))}
                </div>
              </td>
              <td className="px-2 py-2 text-right text-sm text-green-800 tabular-nums">
                ₦{formatNumber(yieldMeta.outputAmount.toFixed(2))}
              </td>
              <td className="px-2 py-2" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
