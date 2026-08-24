/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import {
  RefreshCcw,
  Pencil,
  X,
  Trash2,
  Package,
  ArrowLeft,
  HelpCircle,
  Plus,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";
import MarkupSharedCostsTable from "./MarkupSharedCostsTable";
import {
  getSharedCostRecipeQty,
  normalizeSharedCostQtyUse,
} from "@/hooks/useTemplateByProduct";

function statusBadgeClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "posted")
    return "bg-green-100 text-green-800 border-green-200";
  if (s === "draft") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "rejected" || s === "cancelled")
    return "bg-red-100 text-red-800 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseExpectedYieldFromCostingData(data) {
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
}

function computeCorrectionOutputQty(costingData, productGroups) {
  const productionItems =
    costingData?.productionItems ||
    costingData?.requestData?.productionItems ||
    [];
  if (productionItems.length) {
    return productionItems.reduce((sum, productionItem) => {
      const itemMultiplier = (productionItem.finishedGoods || []).reduce(
        (fgSum, finishedGood) => {
          const quantity =
            parseFloat(
              finishedGood.quantity ??
                finishedGood.qty ??
                finishedGood.outputUnits ??
                0,
            ) || 0;
          let multiplierValue = 1;
          if (
            finishedGood.multiplierValue != null &&
            finishedGood.multiplierValue !== ""
          ) {
            const mv = parseFloat(finishedGood.multiplierValue);
            if (!Number.isNaN(mv) && mv > 0) multiplierValue = mv;
          } else if (finishedGood.multiplier?.multiplier_value) {
            multiplierValue =
              parseFloat(finishedGood.multiplier.multiplier_value) || 1;
          }
          return fgSum + quantity * multiplierValue;
        },
        0,
      );
      return sum + itemMultiplier;
    }, 0);
  }
  return (productGroups || [])
    .filter((g) => !g.isByProduct)
    .reduce(
      (sum, g) => sum + (parseFloat(g.finishedGood?.qty || 0) || 0),
      0,
    );
}

function resolveLineRate(row, rateFor) {
  if (row.store_entry_id && rateFor) {
    return (
      parseFloat(rateFor(row.store_entry_id, row.cost_price ?? row.rate)) || 0
    );
  }
  return parseFloat(row.cost_price || row.rate || 0) || 0;
}

function lineAmount(row, qtyFor, rateFor) {
  const kind = row.kind || row.rowType || "other_cost";
  const isRm = kind === "raw_material";
  const isBp = kind === "by_product_credit" || kind === "by_product";
  const q =
    isRm || isBp
      ? parseFloat(qtyFor?.(row.store_entry_id, row.qty) || row.qty || 0) || 0
      : parseFloat(row.qty || 0) || 0;
  const rate = resolveLineRate(row, rateFor);
  if (isBp) return -Math.abs(q * rate);
  if (isRm) return q * rate;
  return parseFloat(row.amount || row.dr || row.cr || rate || 0) || 0;
}

function inputTypeForRow(row, isRm, isBp) {
  if (isRm) return "qty";
  if (isBp) return "rate";
  const t = String(row.input_type || row.other_type || "").toLowerCase();
  if (t === "percentage" || t === "%") return "%";
  if (t === "qty" || t === "quantity") return "qty";
  return "rate";
}

/** Map Costing & Pricing sharedCosts JSON → Markup table row shape. */
function transformCostingSharedCosts(rawCosts = []) {
  return (rawCosts || []).map((cost, index) => {
    let otherType = cost.otherType || cost.other_type || "rate";
    if (otherType === "%" || otherType === "pct" || otherType === "percent") {
      otherType = "percentage";
    }
    let type = cost.type || "raw_material";
    if (type === "by_product") type = "by_product_credit";
    const recipeQty = getSharedCostRecipeQty(cost);
    const loadedActualQty =
      cost.actual_qty ?? cost.actualQty ?? cost.actualQuantity ?? "";
    const unitCost =
      parseFloat(cost.unit_cost ?? cost.rate ?? cost.rate_amount ?? 0) || 0;
    return {
      id: cost.id || `sc-${index}`,
      type,
      description: cost.description || cost.rawMaterialName || "",
      descriptionCode: cost.descriptionCode || cost.accountHead || "",
      account_code:
        cost.accountHead || cost.account_code || cost.descriptionCode || "",
      accountHead: cost.accountHead || cost.account_code || "",
      rawMaterialId: cost.rawMaterialId || "",
      rawMaterialName: cost.rawMaterialName || cost.description || "",
      rawMaterialSku: cost.rawMaterialSku || cost.sku || "",
      quantity: recipeQty,
      expectedQuantity: recipeQty,
      actualQty: loadedActualQty,
      isActualQtyManuallySet:
        cost.isActualQtyManuallySet ??
        cost.is_actual_qty_manually_set ??
        Boolean(
          loadedActualQty != null && String(loadedActualQty).trim() !== "",
        ),
      unit_cost: unitCost,
      other_type: otherType,
      rate: cost.rate ?? cost.rate_amount ?? (type !== "raw_material" ? unitCost : ""),
      percentage_basis:
        (cost.percentageBasis || cost.percentage_basis) === "raw_material"
          ? "raw_material"
          : cost.percentageBasis || cost.percentage_basis || "all_items",
      store_entry_id: cost.store_entry_id || null,
    };
  });
}


/** Cost breakdown table matching Markup Costing & Pricing columns */
function CostBreakdownTable({
  rows,
  qtyFor,
  rateFor,
  updateItemQty,
  updateItemRate,
  emptyLabel = "No cost lines",
  headClassName = "bg-purple-50",
  showTotals = false,
  totalsLabel = "TOTAL",
}) {
  const computedRows = (rows || []).map((row) => {
    const kind = row.kind || row.rowType || "other_cost";
    const isRm = kind === "raw_material";
    const isBp = kind === "by_product_credit" || kind === "by_product";
    const q =
      isRm || isBp
        ? parseFloat(qtyFor(row.store_entry_id, row.qty) || 0) || 0
        : parseFloat(row.qty || 0) || 0;
    const rate = resolveLineRate(row, rateFor);
    const amount = lineAmount(row, qtyFor, rateFor);
    return { row, kind, isRm, isBp, q, rate, amount };
  });

  const rmTotal = computedRows
    .filter((r) => r.isRm)
    .reduce((s, r) => s + r.amount, 0);
  const otherTotal = computedRows
    .filter((r) => !r.isRm && !r.isBp)
    .reduce((s, r) => s + r.amount, 0);
  const bpTotal = computedRows
    .filter((r) => r.isBp)
    .reduce((s, r) => s + r.amount, 0);
  const subtotal = rmTotal + otherTotal;
  const grandTotal = subtotal + bpTotal;

  return (
    <div className="overflow-x-auto max-w-full min-w-0">
      <table className="w-full table-fixed divide-y divide-gray-200">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[20%]" />
          <col className="w-[16%]" />
          <col className="w-[7%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead className={headClassName}>
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
          {!computedRows.length ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>{emptyLabel}</p>
              </td>
            </tr>
          ) : (
            computedRows.map(({ row, kind, isRm, isBp, q, rate, amount }, idx) => {
              const inputValue = inputTypeForRow(row, isRm, isBp);
              const rowClass = isRm
                ? "bg-orange-50 hover:bg-orange-100"
                : isBp
                  ? "bg-blue-50 hover:bg-blue-100"
                  : "bg-gray-50 hover:bg-gray-100";
              const typeSelectClass = isRm
                ? "bg-orange-100 text-orange-700 border-orange-200"
                : isBp
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-gray-100 text-gray-700 border-gray-200";

              return (
                <tr
                  key={row.store_entry_id || row.transaction_id || `r-${idx}`}
                  className={rowClass}
                >
                  <td className="px-1 py-2 align-top">
                    <select
                      value={
                        isRm
                          ? "raw_material"
                          : isBp
                            ? "by_product_credit"
                            : "other"
                      }
                      disabled
                      className={`text-xs border rounded px-1 py-0.5 font-medium w-full h-9 ${typeSelectClass}`}
                    >
                      <option value="raw_material">Raw Mat.</option>
                      <option value="by_product_credit">By-prod.</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="border border-gray-200 rounded-md bg-white px-2 py-1.5 min-h-9">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {row.product_name || "—"}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {row.account_code || row.sku || "—"}
                        {row.account_description
                          ? ` · ${row.account_description}`
                          : ""}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <Input
                      readOnly
                      value={row.product_name || ""}
                      className="h-9 text-sm bg-white"
                    />
                  </td>
                  <td className="px-1 py-2 align-top">
                    <select
                      disabled
                      value={inputValue}
                      className="text-xs border rounded px-1 py-0.5 w-full h-9 bg-white text-gray-700"
                    >
                      <option value="qty">Qty</option>
                      <option value="rate">Rate</option>
                      <option value="%">%</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top">
                    {row.store_entry_id && updateItemRate ? (
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        className="h-9 text-sm tabular-nums"
                        value={rate}
                        onChange={(e) =>
                          updateItemRate(row.store_entry_id, e.target.value)
                        }
                      />
                    ) : (
                      <div className="h-9 flex items-center text-sm tabular-nums px-2 border border-gray-200 rounded-md bg-white">
                        {fmtMoney(rate)}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="space-y-1">
                      <div className="text-xs text-gray-600">
                        Expected{" "}
                        <span className="tabular-nums font-medium">
                          {Number(row.original_qty ?? q).toFixed(4)} units
                        </span>
                      </div>
                      <div className="text-xs text-green-700 font-semibold flex items-center gap-1 flex-wrap">
                        <span>Actual</span>
                        {row.store_entry_id ? (
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            className="h-8 text-right text-sm tabular-nums bg-green-50 border-green-300 text-green-800 max-w-[7.5rem]"
                            value={qtyFor(row.store_entry_id, row.qty)}
                            onChange={(e) =>
                              updateItemQty(row.store_entry_id, e.target.value)
                            }
                          />
                        ) : (
                          <span className="tabular-nums">
                            {Number(q).toFixed(4)} units
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td
                    className={`px-2 py-2 text-right align-top text-sm font-semibold tabular-nums pt-3 ${
                      amount < 0 ? "text-blue-700" : "text-gray-900"
                    }`}
                  >
                    {fmtMoney(amount)}
                  </td>
                  <td className="px-2 py-2 align-top text-center pt-2.5">
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

          {showTotals && computedRows.length > 0 && (
            <>
              <tr className="bg-slate-50 font-semibold">
                <td
                  colSpan={6}
                  className="px-2 py-2 text-right text-sm text-slate-800"
                >
                  Per recipe unit (subtotal):
                </td>
                <td className="px-2 py-2 text-right text-sm text-slate-800 tabular-nums">
                  ₦{fmtMoney(subtotal)}
                </td>
                <td />
              </tr>
              {bpTotal !== 0 && (
                <tr className="bg-sky-50 font-semibold">
                  <td
                    colSpan={6}
                    className="px-2 py-2 text-right text-sm text-sky-900"
                  >
                    By-Product/Scrap credit:
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-blue-700 tabular-nums">
                    ₦{fmtMoney(bpTotal)}
                  </td>
                  <td />
                </tr>
              )}
              <tr className="bg-blue-50 font-bold">
                <td
                  colSpan={6}
                  className="px-2 py-2 text-right text-sm text-blue-900"
                >
                  {totalsLabel} PER UNIT:
                </td>
                <td className="px-2 py-2 text-right text-sm text-blue-900 tabular-nums">
                  ₦{fmtMoney(grandTotal)}
                </td>
                <td />
              </tr>
              <tr className="bg-purple-50 font-bold">
                <td
                  colSpan={6}
                  className="px-2 py-2 text-right text-sm text-purple-900"
                >
                  {totalsLabel}:
                </td>
                <td className="px-2 py-2 text-right text-sm text-purple-900 tabular-nums">
                  ₦{fmtMoney(grandTotal)}
                </td>
                <td />
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function buildLedgerPreview(ledgerEntries, items, transactionDate) {
  if (!Array.isArray(ledgerEntries) || !ledgerEntries.length) return [];
  const nextDate = transactionDate
    ? moment(transactionDate).format("YYYY-MM-DD")
    : null;

  return ledgerEntries.map((gl) => {
    const ref = String(gl.transaction_ref || "").trim().toLowerCase();
    const desc = String(gl.transaction_description || "").toLowerCase();
    const match = (items || []).find((it) => {
      const sku = String(it.sku || it.product_id || "")
        .trim()
        .toLowerCase();
      if (!sku) return false;
      if (ref === sku) return true;
      if (desc.includes(sku)) return true;
      return false;
    });

    let dr = parseFloat(gl.dr || 0) || 0;
    let cr = parseFloat(gl.cr || 0) || 0;
    if (match) {
      const oldQty = parseFloat(match.original_qty ?? 0) || 0;
      const newQty = parseFloat(match.qty ?? 0) || 0;
      if (oldQty > 0 && Math.abs(oldQty - newQty) > 0.0001) {
        const factor = newQty / oldQty;
        if (dr > 0) dr = Number((dr * factor).toFixed(4));
        if (cr > 0) cr = Number((cr * factor).toFixed(4));
      }
    }

    const date =
      nextDate ||
      (gl.transaction_date
        ? moment(gl.transaction_date).format("YYYY-MM-DD")
        : "");

    return {
      ...gl,
      display_date: date,
      display_dr: dr,
      display_cr: cr,
    };
  });
}

export default function ProductionCorrectionSettings() {
  const dispatch = useDispatch();
  const activeBusiness = useSelector((state) => state.auth.activeBusiness) || {};
  const user = useSelector((state) => state.auth.user) || {};
  const facilityId = activeBusiness?.id;
  const primary = activeBusiness?.primary_color || "var(--aa-navy)";
  const enabled = !!activeBusiness?.enable_production_correction;

  const [toggleLoading, setToggleLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [productGroups, setProductGroups] = useState([]);
  const [sharedCosts, setSharedCosts] = useState({
    rawMaterials: [],
    otherCosts: [],
    byProducts: [],
  });
  /** Markup-shaped shared cost lines from production_costing_records.data */
  const [costingSharedCosts, setCostingSharedCosts] = useState([]);
  const [sharedCostQtyUse, setSharedCostQtyUse] = useState(1);
  const [templateByProduct, setTemplateByProduct] = useState(null);
  const [costingRecordId, setCostingRecordId] = useState(null);
  const [costingData, setCostingData] = useState(null);
  const [rawMaterialProducts, setRawMaterialProducts] = useState([]);
  const [expenseList, setExpenseList] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [productionDate, setProductionDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateCostingSharedCost = (costId, patch) => {
    setCostingSharedCosts((prev) => {
      const next = prev.map((c) => (c.id === costId ? { ...c, ...patch } : c));
      const edited = next.find((c) => c.id === costId);
      // Keep store RM lines in sync with Markup Actual Qty / unit cost edits
      if (
        edited &&
        (edited.type || "raw_material") === "raw_material" &&
        (edited.rawMaterialSku || edited.store_entry_id) &&
        (patch.actualQty != null ||
          patch.unit_cost != null ||
          patch.quantity != null)
      ) {
        const sku = String(edited.rawMaterialSku || "").trim();
        setItems((itemsPrev) =>
          itemsPrev.map((row) => {
            const sameSku =
              sku &&
              (String(row.sku || "") === sku ||
                String(row.product_id || "") === sku);
            const sameStore =
              edited.store_entry_id &&
              row.store_entry_id === edited.store_entry_id;
            if (!sameSku && !sameStore) return row;
            if ((row.kind || row.role) !== "raw_material" && row.qty_out == null)
              return row;
            const isRm =
              (row.kind || row.role) === "raw_material" ||
              parseFloat(row.qty_out || 0) > 0;
            if (!isRm && !sameStore) return row;
            return {
              ...row,
              qty:
                patch.actualQty != null
                  ? patch.actualQty
                  : patch.quantity != null
                    ? patch.quantity
                    : row.qty,
              cost_price:
                patch.unit_cost != null ? patch.unit_cost : row.cost_price,
            };
          }),
        );
      }
      return next;
    });
  };

  const updateItemQty = (storeEntryId, value) => {
    if (!storeEntryId) return;
    setItems((prev) =>
      prev.map((row) =>
        row.store_entry_id === storeEntryId ? { ...row, qty: value } : row,
      ),
    );
  };

  const updateItemRate = (storeEntryId, value) => {
    if (!storeEntryId) return;
    setItems((prev) =>
      prev.map((row) =>
        row.store_entry_id === storeEntryId
          ? { ...row, cost_price: value }
          : row,
      ),
    );
  };

  const qtyFor = (storeEntryId, fallback) => {
    if (!storeEntryId) return fallback ?? "";
    const found = items.find((i) => i.store_entry_id === storeEntryId);
    return found ? found.qty : fallback ?? "";
  };

  const rateFor = (storeEntryId, fallback) => {
    if (!storeEntryId) return fallback ?? 0;
    const found = items.find((i) => i.store_entry_id === storeEntryId);
    return found != null ? found.cost_price : fallback ?? 0;
  };

  const ledgerPreview = useMemo(
    () => buildLedgerPreview(ledgerEntries, items, productionDate),
    [ledgerEntries, items, productionDate],
  );

  const sharedCostExpectedYield = useMemo(
    () => parseExpectedYieldFromCostingData(costingData),
    [costingData],
  );

  const sharedCostOutputQty = useMemo(
    () => computeCorrectionOutputQty(costingData, productGroups),
    [costingData, productGroups],
  );

  useEffect(() => {
    if (!editOpen || !facilityId) return;
    _fetchApi(
      `/inventory/wip?facilityId=${facilityId}`,
      (resp) => {
        if (resp?.success) {
          setRawMaterialProducts(resp.data?.wipItems || []);
        }
      },
      () => {},
    );
    _postApi(
      `/inventory/product-list?query_type=select_administrative_expenses`,
      { facilityId },
      (resp) => {
        if (resp?.success) {
          setExpenseList(
            (resp.results || []).map((item) => ({
              name: item.description,
              code: item.head,
              chart_code: item.subhead,
              account_type: item.account_type || "",
            })),
          );
        }
      },
      () => {},
    );
  }, [editOpen, facilityId]);

  const loadRows = useCallback(() => {
    if (!facilityId) return;
    setListLoading(true);
    const q = encodeURIComponent((search || "").trim());
    _fetchApi(
      `/account/production-correction/batches?facilityId=${facilityId}&q=${q}&limit=50`,
      (resp) => {
        setListLoading(false);
        if (resp?.success) {
          setRows(resp.data || []);
        } else {
          toast.error(resp?.message || "Failed to load production batches");
          setRows([]);
        }
      },
      () => {
        setListLoading(false);
        toast.error("Could not load production batches");
        setRows([]);
      },
    );
  }, [facilityId, search]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const toggleEnabled = () => {
    if (!facilityId) return;
    const userId = user?.id || activeBusiness.business_admin;
    const next = !enabled;
    setToggleLoading(true);
    _postApi(
      `/account/update-enable-production-correction/${next ? "1" : "0"}/${facilityId}/${userId}`,
      {},
      (resp) => {
        setToggleLoading(false);
        if (resp?.success && resp.results) {
          dispatch({
            type: UPDATE_BUSINESS_SETTINGS,
            payload: { business: resp.results },
          });
          toast.success(resp.message || "Setting updated");
        } else {
          toast.error(resp?.message || "Failed to update setting");
        }
      },
      (err) => {
        setToggleLoading(false);
        toast.error(err?.message || "Network error");
      },
    );
  };

  const requireEnabled = () => {
    if (enabled) return true;
    toast.error("Enable production correction above to edit or delete batches");
    return false;
  };

  const loadPostings = (row) => {
    if (!facilityId || !row?.batch_no) return;
    setItemsLoading(true);
    _fetchApi(
      `/account/production-correction/${encodeURIComponent(row.batch_no)}/postings?facilityId=${facilityId}`,
      (resp) => {
        setItemsLoading(false);
        if (resp?.success) {
          const data = resp.data || {};
          setItems(
            (data.items || []).map((it) => ({
              ...it,
              qty: parseFloat(it.qty || it.original_qty || 0) || 0,
              original_qty: parseFloat(it.original_qty || it.qty || 0) || 0,
              cost_price: parseFloat(it.cost_price || 0) || 0,
            })),
          );
          setProductGroups(data.productGroups || []);
          setSharedCosts(
            data.sharedCosts || {
              rawMaterials: [],
              otherCosts: [],
              byProducts: [],
            },
          );
          setCostingRecordId(data.costing_record_id || null);
          setCostingData(data.costingData || null);
          setTemplateByProduct(data.templateByProduct || null);
          setSharedCostQtyUse(
            normalizeSharedCostQtyUse(data.qtyUse ?? 1),
          );
          const rawShared =
            data.costingData?.sharedCosts ||
            data.costingData?.requestData?.sharedCosts ||
            [];
          if (Array.isArray(rawShared) && rawShared.length > 0) {
            setCostingSharedCosts(transformCostingSharedCosts(rawShared));
          } else {
            // Fallback: rebuild Markup-like lines from postings bags
            const fallback = [
              ...(data.sharedCosts?.rawMaterials || []).map((r) => ({
                type: "raw_material",
                description: r.product_name,
                rawMaterialName: r.product_name,
                rawMaterialSku: r.sku,
                quantity: r.original_qty ?? r.qty,
                expectedQuantity: r.original_qty ?? r.qty,
                actualQty: r.qty,
                unit_cost: r.cost_price,
                store_entry_id: r.store_entry_id,
              })),
              ...(data.sharedCosts?.otherCosts || []).map((r) => ({
                type: "other",
                description: r.product_name,
                descriptionCode: r.account_code,
                account_code: r.account_code,
                other_type: r.input_type === "%" ? "percentage" : "rate",
                rate: r.cost_price ?? r.amount,
                quantity: r.qty,
                percentage_basis: "all_items",
                amount: r.amount,
              })),
              ...(data.sharedCosts?.byProducts || []).map((r) => ({
                type: "by_product_credit",
                description: r.product_name,
                descriptionCode: r.account_code,
                other_type: "rate",
                rate: r.cost_price,
                quantity: r.qty,
                store_entry_id: r.store_entry_id,
              })),
            ];
            setCostingSharedCosts(transformCostingSharedCosts(fallback));
          }
          setLedgerEntries(data.ledgerEntries || []);
          setProductionDate(
            data.production_date
              ? moment(data.production_date).format("YYYY-MM-DD")
              : row.production_date
                ? moment(row.production_date).format("YYYY-MM-DD")
                : "",
          );
        } else {
          toast.error(resp?.message || "Failed to load postings");
          setItems([]);
          setProductGroups([]);
          setSharedCosts({ rawMaterials: [], otherCosts: [], byProducts: [] });
          setCostingSharedCosts([]);
          setCostingData(null);
          setTemplateByProduct(null);
          setLedgerEntries([]);
        }
      },
      () => {
        setItemsLoading(false);
        toast.error("Could not load postings");
        setItems([]);
        setProductGroups([]);
        setSharedCosts({ rawMaterials: [], otherCosts: [], byProducts: [] });
        setCostingSharedCosts([]);
        setCostingData(null);
        setTemplateByProduct(null);
        setLedgerEntries([]);
      },
    );
  };

  const openEdit = (row) => {
    if (!requireEnabled()) return;
    setSelected(row);
    setConfirmDeleteOpen(false);
    setEditOpen(true);
    setItems([]);
    setProductGroups([]);
    setSharedCosts({ rawMaterials: [], otherCosts: [], byProducts: [] });
    setCostingSharedCosts([]);
    setCostingData(null);
    setTemplateByProduct(null);
    setLedgerEntries([]);
    setProductionDate(
      row.production_date
        ? moment(row.production_date).format("YYYY-MM-DD")
        : "",
    );
    loadPostings(row);
  };

  const openDelete = (row) => {
    if (!requireEnabled()) return;
    setSelected(row);
    setEditOpen(true);
    setConfirmDeleteOpen(true);
    setItems([]);
    setProductGroups([]);
    setSharedCosts({ rawMaterials: [], otherCosts: [], byProducts: [] });
    setCostingSharedCosts([]);
    setCostingData(null);
    setTemplateByProduct(null);
    setLedgerEntries([]);
    loadPostings(row);
  };

  const closeEdit = () => {
    if (saving || deleting) return;
    setEditOpen(false);
    setConfirmDeleteOpen(false);
    setSelected(null);
    setItems([]);
    setProductGroups([]);
    setSharedCosts({ rawMaterials: [], otherCosts: [], byProducts: [] });
    setCostingSharedCosts([]);
    setCostingData(null);
    setTemplateByProduct(null);
    setLedgerEntries([]);
  };

  const saveEdit = () => {
    if (!selected?.batch_no || !facilityId) return;
    if (!productionDate) {
      toast.error("Production date is required");
      return;
    }
    for (const it of items) {
      const q = parseFloat(it.qty);
      if (!Number.isFinite(q) || q < 0) {
        toast.error(`Invalid qty for ${it.product_name || it.sku}`);
        return;
      }
    }
    setSaving(true);
    // Prefer Markup shared-cost Actual Qty / rates for matching RM store lines
    const itemsForSave = items.map((it) => {
      const sku = String(it.sku || it.product_id || "").trim();
      const sc = costingSharedCosts.find(
        (c) =>
          (c.type || "raw_material") === "raw_material" &&
          ((sku &&
            (String(c.rawMaterialSku || "") === sku ||
              String(c.rawMaterialId || "") === sku)) ||
            (c.store_entry_id && c.store_entry_id === it.store_entry_id)),
      );
      if (!sc) return it;
      const actual =
        sc.actualQty != null && String(sc.actualQty).trim() !== ""
          ? sc.actualQty
          : sc.quantity;
      return {
        ...it,
        qty: actual != null && actual !== "" ? actual : it.qty,
        cost_price:
          sc.unit_cost != null && sc.unit_cost !== ""
            ? sc.unit_cost
            : it.cost_price,
      };
    });
    _postApi(
      "/account/production-correction/correct",
      {
        facilityId,
        batchNo: selected.batch_no,
        productionDate,
        userId: user?.id,
        costingRecordId,
        qtyUse: sharedCostQtyUse,
        templateByProduct,
        markupSharedCosts: calculateSharedCostAmounts(
          costingSharedCosts,
          sharedCostQtyUse,
        ),
        items: itemsForSave.map((it) => ({
          store_entry_id: it.store_entry_id,
          sku: it.sku || it.product_id,
          product_id: it.product_id || it.sku,
          kind: it.kind || it.role,
          qty: parseFloat(it.qty) || 0,
          cost_price: parseFloat(it.cost_price) || 0,
          amount: lineAmount(
            it,
            (id, fallback) => {
              const row = itemsForSave.find((x) => x.store_entry_id === id);
              return row?.qty ?? fallback;
            },
            (id, fallback) => {
              const row = itemsForSave.find((x) => x.store_entry_id === id);
              return row?.cost_price ?? fallback;
            },
          ),
        })),
        productGroups: (productGroups || []).map((g) => ({
          key: g.key,
          title: g.title,
          finishedGood: g.finishedGood
            ? {
                ...g.finishedGood,
                qty:
                  itemsForSave.find(
                    (it) =>
                      it.store_entry_id &&
                      it.store_entry_id === g.finishedGood?.store_entry_id,
                  )?.qty ?? g.finishedGood.qty,
                cost_price:
                  itemsForSave.find(
                    (it) =>
                      it.store_entry_id &&
                      it.store_entry_id === g.finishedGood?.store_entry_id,
                  )?.cost_price ?? g.finishedGood.cost_price,
              }
            : null,
          rawMaterials: (g.rawMaterials || []).map((r) => ({
            ...r,
            qty:
              itemsForSave.find((it) => it.store_entry_id === r.store_entry_id)
                ?.qty ?? r.qty,
            cost_price:
              itemsForSave.find((it) => it.store_entry_id === r.store_entry_id)
                ?.cost_price ?? r.cost_price,
          })),
          otherCosts: g.otherCosts || [],
        })),
        sharedCosts: {
          rawMaterials: (sharedCosts?.rawMaterials || []).map((r) => {
            const matched = itemsForSave.find(
              (it) => it.store_entry_id === r.store_entry_id,
            );
            const qty = matched?.qty ?? r.qty;
            const cost_price = matched?.cost_price ?? r.cost_price;
            return {
              ...r,
              qty,
              cost_price,
              amount: lineAmount({ ...r, qty, cost_price }, null, null),
            };
          }),
          otherCosts: sharedCosts?.otherCosts || [],
          byProducts: (sharedCosts?.byProducts || []).map((r) => {
            const matched = itemsForSave.find(
              (it) => it.store_entry_id === r.store_entry_id,
            );
            const qty = matched?.qty ?? r.qty;
            const cost_price = matched?.cost_price ?? r.cost_price;
            return {
              ...r,
              qty,
              cost_price,
              amount: lineAmount({ ...r, qty, cost_price }, null, null),
            };
          }),
        },
      },
      (resp) => {
        setSaving(false);
        if (resp?.success) {
          const storeN = resp.data?.store_entries_updated ?? 0;
          const ledgerN = resp.data?.ledger_entries_updated ?? 0;
          const archiveId = resp.data?.archive_id;
          toast.success(
            resp.message ||
              (resp.data?.rebuilt
                ? `Backup saved · rebuilt ${storeN} store, ${ledgerN} ledger`
                : `Updated (${storeN} store, ${ledgerN} ledger entries)`),
          );
          if (archiveId) {
            toast.message(`Archive id: ${archiveId}`);
          }
          closeEdit();
          loadRows();
        } else {
          toast.error(resp?.message || "Update failed");
        }
      },
      (err) => {
        setSaving(false);
        toast.error(err?.message || "Update failed");
      },
    );
  };

  const confirmDelete = () => {
    if (!selected?.batch_no || !facilityId) return;
    setDeleting(true);
    _postApi(
      "/account/production-correction/delete",
      {
        facilityId,
        batchNo: selected.batch_no,
        userId: user?.id,
      },
      (resp) => {
        setDeleting(false);
        if (resp?.success) {
          toast.success(
            resp.message || "Backup saved · batch postings deleted",
          );
          if (resp.data?.archive_id) {
            toast.message(`Archive id: ${resp.data.archive_id}`);
          }
          closeEdit();
          loadRows();
        } else {
          toast.error(resp?.message || "Delete failed");
        }
      },
      (err) => {
        setDeleting(false);
        toast.error(err?.message || "Delete failed");
      },
    );
  };

  return (
    <div className="card shadow-sm border-0">
      <div
        className="card-header border-0 text-white"
        style={{
          background: "var(--aa-navy)",
          padding: "1rem 1.25rem",
        }}
      >
        <h5 className="mb-0 fw-bold">Production Correction</h5>
        <small className="opacity-75">
          Correct completed batch dates, store quantities, and ledger amounts
        </small>
      </div>

      <div className="card-body space-y-4">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 p-3 rounded border bg-light">
          <div className="flex-grow-1" style={{ minWidth: 220 }}>
            <div className="fw-semibold text-dark mb-1">
              Allow production correction
            </div>
            <p className="text-muted small mb-0">
              Posted completed production batches are listed below. Turn this on
              to edit dates, quantities, and ledger amounts.
            </p>
          </div>
          <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="enableProductionCorrection"
              checked={enabled}
              onChange={toggleEnabled}
              disabled={toggleLoading}
              style={{
                width: "2.75rem",
                height: "1.35rem",
                accentColor: primary,
              }}
            />
            <label
              className="form-check-label small fw-semibold text-nowrap"
              htmlFor="enableProductionCorrection"
            >
              {toggleLoading ? "Saving…" : enabled ? "Enabled" : "Disabled"}
            </label>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 align-items-end justify-content-between">
          <div className="flex-grow-1" style={{ maxWidth: 360 }}>
            <Label className="small text-muted">Search</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by batch…"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadRows}
            disabled={listLoading}
          >
            <RefreshCcw
              className={`h-4 w-4 mr-1 ${listLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div className="border rounded overflow-auto max-h-96">
          <table className="table table-sm mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Production Date</th>
                <th>Batch</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.batch_no}>
                  <td>
                    {r.production_date
                      ? moment(r.production_date).format("DD/MM/YYYY")
                      : "—"}
                  </td>
                  <td>
                    <div className="font-medium text-sm text-blue-700">
                      {r.batch_no}
                    </div>
                  </td>
                  <td>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(r.status)}
                    >
                      {r.status || "—"}
                    </Badge>
                  </td>
                  <td className="text-end whitespace-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mr-1"
                      disabled={!enabled}
                      title={
                        enabled
                          ? "Edit batch"
                          : "Enable production correction to edit"
                      }
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      disabled={!enabled}
                      title={
                        enabled
                          ? "Delete batch postings"
                          : "Enable production correction to delete"
                      }
                      onClick={() => openDelete(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && !listLoading && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    No production costing records found
                  </td>
                </tr>
              )}
              {listLoading && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!enabled && (
          <p className="text-muted small mb-0">
            Enable production correction above to edit or delete batch
            postings from Costing &amp; Pricing.
          </p>
        )}
      </div>

      {editOpen && selected && (
        <div className="fixed inset-0 z-[1100] bg-gray-50 flex flex-col animate-in fade-in duration-200">
          {/* Header — matches Costing & Pricing detail */}
          <div className="bg-[var(--aa-navy)] text-white px-4 py-4 shadow-md shrink-0">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  disabled={saving || deleting}
                  onClick={closeEdit}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all shrink-0"
                  aria-label="Back"
                >
                  <ArrowLeft size={22} />
                </button>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold truncate">
                    {confirmDeleteOpen
                      ? `Delete Production — ${selected.batch_no}`
                      : `Production Costing — ${selected.batch_no}`}
                  </h1>
                  <p className="text-blue-100 text-sm mt-0.5">
                    {confirmDeleteOpen
                      ? "Remove store and ledger postings for this batch"
                      : "Correct overhead costs and production batch postings"}
                  </p>
                </div>
              </div>
              {!confirmDeleteOpen && (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-100 text-sm font-semibold whitespace-nowrap">
                      Production Date:
                    </span>
                    <input
                      type="date"
                      value={productionDate}
                      onChange={(e) => setProductionDate(e.target.value)}
                      className="px-2 py-1 rounded-md border border-blue-200 bg-white/10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    disabled={saving || itemsLoading}
                    onClick={closeEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={saving || itemsLoading}
                    className="bg-white text-blue-700 hover:bg-blue-50"
                    onClick={saveEdit}
                  >
                    {saving ? "Saving…" : "Save correction"}
                  </Button>
                </div>
              )}
              {confirmDeleteOpen && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                    disabled={deleting}
                    onClick={closeEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={deleting}
                    className="bg-red-500 text-white hover:bg-red-600"
                    onClick={confirmDelete}
                  >
                    {deleting ? "Deleting…" : "Delete postings"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-4 max-w-[1600px] w-full mx-auto min-w-0">
              {confirmDeleteOpen ? (
                <div className="bg-white rounded-lg border border-red-200 p-6 shadow-sm">
                  <p className="text-sm text-slate-700">
                    This removes store movements and general ledger lines for{" "}
                    <strong>{selected.batch_no}</strong>. This cannot be undone.
                  </p>
                </div>
              ) : itemsLoading ? (
                <div className="min-h-[40vh] flex flex-col items-center justify-center text-gray-600">
                  <span className="animate-spin text-2xl mb-3">⏳</span>
                  <p>Loading production batch…</p>
                </div>
              ) : (
                <>
                  {/* Shared Costs — same data & math as Markup Costing & Pricing */}
                  {costingSharedCosts.length > 0 && (
                    <div className="mb-6 bg-white rounded-lg border border-purple-200 shadow-sm min-w-0 overflow-hidden">
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
                                {costingRecordId
                                  ? ` · ${costingRecordId}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700">
                            {costingSharedCosts.length} item(s)
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center p-2">
                          <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
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
                                <Button
                                  size="sm"
                                  disabled
                                  className="text-xs bg-purple-600 text-white hover:bg-purple-700 opacity-60 cursor-not-allowed"
                                  title="Adding lines is not available in production correction"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Line
                                  <ChevronDown className="h-3 w-3 ml-1" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem disabled>
                                  Raw Material
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  By-product credit
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>Other</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                        <MarkupSharedCostsTable
                          sharedCosts={costingSharedCosts}
                          qtyUse={sharedCostQtyUse}
                          templateByProduct={templateByProduct}
                          onUpdateCost={updateCostingSharedCost}
                          rawMaterialProducts={rawMaterialProducts}
                          expenseList={expenseList}
                          expectedYieldPercent={sharedCostExpectedYield}
                          outputQty={sharedCostOutputQty}
                        />
                      </div>
                    </div>
                  )}

                  {/* Production Items — Markup style */}
                  <div className="space-y-6 mb-6">
                    {productGroups
                      .filter((g) => !g.isByProduct)
                      .map((group, gIdx) => {
                        const fg = group.finishedGood || {};
                        const fgQty = parseFloat(
                          qtyFor(fg.store_entry_id, fg.qty) || 0,
                        );
                        const fgRate =
                          parseFloat(
                            rateFor(fg.store_entry_id, fg.cost_price) || 0,
                          ) || 0;
                        const breakdownRows = [
                          ...(group.rawMaterials || []).map((rm) => ({
                            ...rm,
                            kind: "raw_material",
                          })),
                          ...(group.otherCosts || []).map((oc) => ({
                            ...oc,
                            kind: "other_cost",
                          })),
                        ];
                        return (
                          <div
                            key={group.key}
                            className="bg-white rounded-lg overflow-hidden border border-gray-200"
                          >
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-100">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-[var(--aa-navy)] rounded-lg flex items-center justify-center text-white font-bold">
                                    {gIdx + 1}
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                      Production Item #{gIdx + 1}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      {group.title || fg.product_name || "Product"}{" "}
                                      • 1 finished good(s) •{" "}
                                      {breakdownRows.length} ingredient(s)
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 border-b border-gray-200 bg-gray-50">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                  Finished Goods
                                </h5>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border border-gray-200 rounded-lg p-3">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">
                                    Product
                                  </div>
                                  <div className="text-sm font-semibold text-gray-900">
                                    {fg.product_name || group.title}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {fg.sku || "—"}
                                    {fg.branch_name
                                      ? ` · ${fg.branch_name}`
                                      : ""}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">
                                    Qty produced
                                  </div>
                                  {fg.store_entry_id ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="h-9 text-right"
                                      value={qtyFor(fg.store_entry_id, fg.qty)}
                                      onChange={(e) =>
                                        updateItemQty(
                                          fg.store_entry_id,
                                          e.target.value,
                                        )
                                      }
                                    />
                                  ) : (
                                    <div className="text-sm font-medium">
                                      {fgQty}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">
                                    Unit cost
                                  </div>
                                  <div className="text-sm font-medium tabular-nums">
                                    {fmtMoney(fgRate)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">
                                    Total value
                                  </div>
                                  <div className="text-sm font-bold tabular-nums text-[var(--aa-navy)]">
                                    {fmtMoney(fgQty * fgRate)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="">
                              <div className="flex justify-between items-center p-2">
                                <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                  Cost Breakdown
                                </h5>
                              </div>
                              <CostBreakdownTable
                                qtyFor={qtyFor}
                                rateFor={rateFor}
                                updateItemQty={updateItemQty}
                                updateItemRate={updateItemRate}
                                showTotals
                                totalsLabel="TOTAL PRODUCT COSTS"
                                headClassName="bg-gray-50"
                                emptyLabel="No product-specific costs. Shared costs are listed above."
                                rows={breakdownRows}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {!productGroups.filter((g) => !g.isByProduct).length &&
                    costingSharedCosts.length === 0 && (
                      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
                        <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p>No product postings for this batch</p>
                      </div>
                    )}

                  {ledgerPreview.length > 0 && (
                    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b bg-gray-50">
                        <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                          General Ledger
                        </h5>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">
                                Account
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-gray-600">
                                Description
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-600">
                                Dr
                              </th>
                              <th className="px-3 py-2 text-right text-xs font-bold uppercase text-gray-600">
                                Cr
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {ledgerPreview.map((gl) => (
                              <tr key={gl.transaction_id}>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {gl.display_date
                                    ? moment(gl.display_date).format(
                                        "DD/MM/YYYY",
                                      )
                                    : "—"}
                                </td>
                                <td className="px-3 py-2">
                                  <div>{gl.account_description || "—"}</div>
                                  <div className="text-xs text-gray-500">
                                    {gl.account_code}
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  {gl.transaction_description || "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {gl.display_dr > 0
                                    ? fmtMoney(gl.display_dr)
                                    : ""}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {gl.display_cr > 0
                                    ? fmtMoney(gl.display_cr)
                                    : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
