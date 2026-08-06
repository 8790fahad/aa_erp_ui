/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  Save,
  Loader2,
  Package,
  Tag,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";
import { UPDATE_BUSINESS_SETTINGS } from "@/redux/actions/actionTypes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
} from "@/utilities";

const ITEM_TYPES = ["Finished Good", "By-Product", "Resalable"];

const TYPE_BADGE = {
  "Finished Good": "border-sky-200 bg-sky-50 text-sky-800",
  "By-Product": "border-amber-200 bg-amber-50 text-amber-900",
  Resalable: "border-indigo-200 bg-indigo-50 text-indigo-800",
};

const inputClass =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-right text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20";

const priceColClass = "ml-auto w-[140px]";
const sellingColClass = "ml-auto w-[168px]";

function formatAmountInput(value) {
  const withoutCommas = String(value || "").replace(/,/g, "");
  const sanitizedValue = filterJournalAmountInput(withoutCommas);
  const parts = sanitizedValue.split(".");
  const numericValue =
    parts.length > 2
      ? parts[0] + "." + parts.slice(1).join("")
      : sanitizedValue;
  return formatNumberWithCommas(numericValue);
}

function calcSellingFromMarkup(cost, markup, mode) {
  const c = parseFloat(cost) || 0;
  const m = parseFloat(markup) || 0;
  if (mode === "fixed") return c + m;
  return c + (c * m) / 100;
}

/**
 * @param {{ embedded?: boolean }} props — When true, render as a settings section (no page chrome).
 */
export default function PriceSetup({ embedded = false }) {
  const dispatch = useDispatch();
  const { activeBusiness = {} } = useSelector((state) => state.auth);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [valuationMethod, setValuationMethod] = useState("WAC");
  const [valuationMethodLabel, setValuationMethodLabel] = useState(
    "Weighted Average Cost (WAC)"
  );
  const [priceSetupPurchaseLoading, setPriceSetupPurchaseLoading] =
    useState(false);
  const [calcProduct, setCalcProduct] = useState(null);
  const [calcMode, setCalcMode] = useState("percentage");
  const [calcMarkup, setCalcMarkup] = useState("");

  const load = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const q = new URLSearchParams({
      itemTypes: ITEM_TYPES.join(","),
      status: "Active",
      limit: "5000",
      sortBy: "name",
      sortOrder: "ASC",
    });
    _fetchApi(
      `/api/products/list/${activeBusiness.id}?${q.toString()}`,
      (resp) => {
        setLoading(false);
        if (resp.success && Array.isArray(resp.data)) {
          setRows(resp.data);
          setDrafts({});
          if (resp.metrics?.valuation_method) {
            setValuationMethod(resp.metrics.valuation_method);
          }
          if (resp.metrics?.valuation_method_label) {
            setValuationMethodLabel(resp.metrics.valuation_method_label);
          } else if (activeBusiness?.inv_ev_m) {
            setValuationMethodLabel(activeBusiness.inv_ev_m);
          }
        } else {
          toast.error(resp.message || "Failed to load products");
          setRows([]);
        }
      },
      () => {
        setLoading(false);
        toast.error("Could not load products");
        setRows([]);
      }
    );
  }, [activeBusiness?.id, activeBusiness?.inv_ev_m]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(t) ||
        (p.sku || "").toLowerCase().includes(t) ||
        (p.category || "").toLowerCase().includes(t)
    );
  }, [rows, search]);

  const setDraft = (id, patch) => {
    setDrafts((d) => ({
      ...d,
      [id]: {
        ...d[id],
        ...(typeof patch === "object" && patch !== null
          ? Object.fromEntries(
              Object.entries(patch).map(([field, value]) => {
                if (field === "selling_price" || field === "mark_up") {
                  return [field, formatAmountInput(value)];
                }
                return [field, value];
              })
            )
          : {}),
      },
    }));
  };

  const setSellingDraft = (id, value) => {
    setDraft(id, { selling_price: value });
  };

  const displaySellingPrice = (p) => {
    const d = drafts[p.id];
    if (d && d.selling_price !== undefined && d.selling_price !== "") {
      return d.selling_price;
    }
    const v = p.selling_price;
    if (v === null || v === undefined || v === "") return "";
    return formatNumberWithCommas(String(v));
  };

  const valuationCostOf = (p) => {
    const fromVal = parseFloat(p.valuation_cost ?? p.avg_unit_cost ?? 0) || 0;
    if (fromVal > 0) return fromVal;
    return parseFloat(p.cost_price || 0) || 0;
  };

  const displayValuationCost = (p) => {
    const v = valuationCostOf(p);
    if (!v) return "—";
    return formatNumberWithCommas(v.toFixed(2));
  };

  const openCalcModal = (p) => {
    const draft = drafts[p.id] || {};
    const mode =
      draft.markup_mode || p.markup_mode || "percentage";
    const markupRaw =
      draft.mark_up !== undefined && draft.mark_up !== ""
        ? draft.mark_up
        : p.mark_up != null && p.mark_up !== ""
          ? p.mark_up
          : "";
    setCalcProduct(p);
    setCalcMode(mode === "fixed" || mode === "amount" ? "fixed" : "percentage");
    setCalcMarkup(
      markupRaw === "" || markupRaw == null
        ? ""
        : formatAmountInput(String(markupRaw))
    );
  };

  const calcPreview = useMemo(() => {
    if (!calcProduct) {
      return { cost: 0, markup: 0, selling: 0, markupAmount: 0 };
    }
    const cost = valuationCostOf(calcProduct);
    const markup = parseFloat(parseNumberFromFormatted(String(calcMarkup))) || 0;
    const selling = calcSellingFromMarkup(cost, markup, calcMode);
    const markupAmount = selling - cost;
    return {
      cost,
      markup,
      selling: Number(selling.toFixed(2)),
      markupAmount: Number(markupAmount.toFixed(2)),
    };
  }, [calcProduct, calcMarkup, calcMode]);

  const applyCalc = () => {
    if (!calcProduct) return;
    if (calcPreview.cost <= 0) {
      toast.error("No valuation cost available for this product");
      return;
    }
    if (calcPreview.selling < 0 || Number.isNaN(calcPreview.selling)) {
      toast.error("Enter a valid markup");
      return;
    }
    setDraft(calcProduct.id, {
      selling_price: calcPreview.selling.toFixed(2),
      mark_up: String(calcPreview.markup),
      markup_mode: calcMode,
    });
    setCalcProduct(null);
    toast.success("Selling price calculated — click Save to store it");
  };

  const saveRow = (p) => {
    const draft = drafts[p.id];
    const selling =
      draft?.selling_price !== undefined
        ? draft.selling_price
        : p.selling_price;
    const sellNum = parseFloat(parseNumberFromFormatted(String(selling)));
    if (selling === "" || Number.isNaN(sellNum) || sellNum < 0) {
      toast.error("Enter a valid selling price");
      return;
    }

    const costNum = valuationCostOf(p);
    const markupMode =
      draft?.markup_mode || p.markup_mode || "percentage";
    const markupSrc =
      draft?.mark_up !== undefined && draft?.mark_up !== ""
        ? draft.mark_up
        : p.mark_up;
    const markupNum = parseFloat(parseNumberFromFormatted(String(markupSrc ?? "")));

    setSavingId(p.id);
    _putApi(
      `/api/products/${activeBusiness.id}/${p.id}`,
      {
        selling_price: sellNum,
        ...(costNum > 0 ? { cost_price: costNum } : {}),
        ...(!Number.isNaN(markupNum)
          ? { mark_up: markupNum, markup_mode: markupMode }
          : {}),
      },
      (resp) => {
        setSavingId(null);
        if (resp.success) {
          toast.success("Selling price updated");
          setRows((prev) =>
            prev.map((r) =>
              r.id === p.id
                ? {
                    ...r,
                    selling_price: sellNum,
                    ...(costNum > 0 ? { cost_price: costNum } : {}),
                    ...(!Number.isNaN(markupNum)
                      ? { mark_up: markupNum, markup_mode: markupMode }
                      : {}),
                  }
                : r
            )
          );
          setDrafts((d) => {
            const next = { ...d };
            delete next[p.id];
            return next;
          });
        } else {
          toast.error(resp.message || "Update failed");
        }
      },
      () => {
        setSavingId(null);
        toast.error("Network error");
      }
    );
  };

  const togglePriceSetupOnSupplierBill = () => {
    if (!activeBusiness?.id || !activeBusiness?.business_admin) return;
    const next = !activeBusiness.price_setup_resalable_on_purchase;
    setPriceSetupPurchaseLoading(true);
    _postApi(
      `/account/update-price-setup-resalable-purchase/${next}/${activeBusiness.id}/${activeBusiness.business_admin}`,
      {},
      (resp) => {
        setPriceSetupPurchaseLoading(false);
        if (resp?.success && resp.results) {
          toast.success(
            next
              ? "Supplier bills will set selling price on for-sales stock for Finished Good, Resalable, and By-Product lines."
              : "Selling price setup on supplier bill turned off."
          );
          dispatch({
            type: UPDATE_BUSINESS_SETTINGS,
            payload: { business: resp.results },
          });
        } else {
          toast.error(resp?.message || "Could not update setting");
        }
      },
      () => {
        setPriceSetupPurchaseLoading(false);
        toast.error("Network error");
      }
    );
  };

  const enabled = !!activeBusiness.price_setup_resalable_on_purchase;

  const content = (
    <div id="price-setup" className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
          <Tag className="h-5 w-5 text-[#4267B2]" />
          Price Set-up
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Cost from inventory valuation (stock movements). Set selling price for
          Finished Good, By-Product &amp; Resalable products.
        </p>
        <div className="mt-2 inline-flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Valuation method
          </span>
          <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
            {valuationMethodLabel}
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {valuationMethod}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <div className="min-w-[220px] flex-1">
          <div className="text-sm font-semibold text-slate-800">
            Selling price on supplier bill
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            When enabled, Product Supplier Bills apply each product&apos;s
            selling price on{" "}
            <code className="rounded bg-slate-200/80 px-1">for sales</code> stock
            for Finished Good, Resalable, and By-Product lines.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={priceSetupPurchaseLoading}
          onClick={togglePriceSetupOnSupplierBill}
          className={`relative inline-flex h-7 w-[3.25rem] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#4267B2]/30 disabled:opacity-60 ${
            enabled ? "bg-[#4267B2]" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              enabled ? "translate-x-[1.55rem]" : "translate-x-1"
            }`}
          />
          <span className="sr-only">
            {priceSetupPurchaseLoading
              ? "Saving"
              : enabled
                ? "Disable"
                : "Enable"}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by name, SKU, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20"
            disabled={loading}
          />
        </div>
        <span className="text-xs text-slate-500 sm:whitespace-nowrap">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="divide-y divide-slate-100">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="grid grid-cols-6 gap-3 py-2.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-4 w-full max-w-[120px]" />
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center">
          <Package className="mx-auto mb-2 h-10 w-10 text-slate-200" />
          <h3 className="mb-1 text-sm font-semibold text-slate-700">
            No products found
          </h3>
          <p className="text-sm text-slate-500">
            {search.trim()
              ? "Try adjusting your search"
              : "No Finished Good, By-Product, or Resalable products yet"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <colgroup>
              <col />
              <col className="w-[8rem]" />
              <col className="w-[8.5rem]" />
              <col className="w-[10rem]" />
              <col className="w-[12rem]" />
              <col className="w-[6.5rem]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-1 py-2.5 text-left font-semibold">Product</th>
                <th className="px-3 py-2.5 text-left font-semibold">SKU</th>
                <th className="px-3 py-2.5 text-left font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">
                  <div className={`${priceColClass} text-right`}>
                    <div>Cost ({valuationMethod})</div>
                    <div className="normal-case tracking-normal text-[10px] font-normal text-slate-400">
                      valuation
                    </div>
                  </div>
                </th>
                <th className="px-3 py-2.5 font-semibold">
                  <div className={`${sellingColClass} text-right`}>
                    Selling price
                  </div>
                </th>
                <th className="px-1 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => {
                const dirty = !!drafts[p.id];
                return (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-1 py-2.5 text-left font-medium text-slate-800">
                      {p.name}
                    </td>
                    <td className="px-3 py-2.5 text-left font-mono text-xs text-slate-600">
                      {p.sku}
                    </td>
                    <td className="px-3 py-2.5 text-left">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                          TYPE_BADGE[p.item_type] ||
                          "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {p.item_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div
                        className={`${priceColClass} text-right text-sm tabular-nums text-slate-700`}
                        title="From inventory valuation (store movements)"
                      >
                        {displayValuationCost(p) === "—"
                          ? "—"
                          : `₦${displayValuationCost(p)}`}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className={`${sellingColClass} flex items-center gap-1`}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className={inputClass}
                          value={displaySellingPrice(p)}
                          onChange={(e) =>
                            setSellingDraft(p.id, e.target.value)
                          }
                          placeholder="0.00"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title="Calculate from cost + markup"
                          onClick={() => openCalcModal(p)}
                          className="h-8 w-8 shrink-0 border-slate-200 p-0 text-[#4267B2] hover:bg-sky-50"
                        >
                          <Calculator className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-1 py-2.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingId === p.id}
                        onClick={() => saveRow(p)}
                        className={`h-8 gap-1.5 border-0 text-xs ${
                          dirty
                            ? "bg-[var(--aa-accent)] text-white hover:bg-[var(--aa-accent)]/90"
                            : "bg-[#4267B2] text-white hover:bg-[#4267B2]/90"
                        }`}
                      >
                        {savingId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!calcProduct}
        onOpenChange={(open) => {
          if (!open) setCalcProduct(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Calculate selling price</DialogTitle>
            <DialogDescription>
              {calcProduct
                ? `${calcProduct.name} · ${calcProduct.sku}`
                : "Markup on valuation cost"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Cost ({valuationMethod})</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  ₦{formatNumberWithCommas(calcPreview.cost.toFixed(2))}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {valuationMethodLabel}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs font-medium text-slate-600">
                Markup type
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCalcMode("percentage")}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    calcMode === "percentage"
                      ? "border-[#4267B2] bg-[#4267B2]/10 text-[#4267B2]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Percentage %
                </button>
                <button
                  type="button"
                  onClick={() => setCalcMode("fixed")}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                    calcMode === "fixed"
                      ? "border-[#4267B2] bg-[#4267B2]/10 text-[#4267B2]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Fixed amount ₦
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                {calcMode === "percentage" ? "Markup %" : "Markup amount (₦)"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={calcMarkup}
                onChange={(e) => setCalcMarkup(formatAmountInput(e.target.value))}
                placeholder={calcMode === "percentage" ? "e.g. 25" : "e.g. 800"}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-right text-sm outline-none focus:border-[#4267B2] focus:ring-2 focus:ring-[#4267B2]/20"
              />
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-2 text-slate-600">
                <span>Markup amount</span>
                <span className="tabular-nums">
                  ₦{formatNumberWithCommas(calcPreview.markupAmount.toFixed(2))}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-emerald-200/80 pt-2">
                <span className="font-semibold text-slate-800">
                  Selling price
                </span>
                <span className="text-lg font-bold tabular-nums text-emerald-800">
                  ₦{formatNumberWithCommas(calcPreview.selling.toFixed(2))}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {calcMode === "percentage"
                  ? `Cost + (Cost × ${calcPreview.markup || 0}%)`
                  : `Cost + ₦${formatNumberWithCommas(
                      String(calcPreview.markup || 0)
                    )}`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCalcProduct(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyCalc}
              className="border-0 bg-[#4267B2] text-white hover:bg-[#4267B2]/90"
            >
              Apply to selling price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-[70vh] px-3 py-4 sm:px-4 lg:px-6">{content}</div>
  );
}
