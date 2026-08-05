import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import {
  formatNumberWithCommas,
  parseNumberFromFormatted,
  filterJournalAmountInput,
} from "@/utilities";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { Trash2, Settings, FlaskConical, TrendingUp } from "lucide-react";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const getKey = (option) =>
  String(option?.id || option?.sku || option?.product_id || option?.name || "");

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MixtureModal = ({ isOpen, onClose }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const user = useSelector((state) => state.auth.user);
  const [submitting, setSubmitting] = useState(false);

  /* valuation settings from business */
  const valuationMethod = activeBusiness?.inv_ev_m || "Weighted Average Cost";
  const valuationDate = activeBusiness?.valuation_date || "All";

  const createEmptyIngredient = () => ({
    id: Date.now() + Math.random(),
    name: "",
    sku: "",
    selectedOption: null,
    quantity: "",
    available: 0,
    unit_cost: 0,
    unit_of_measure: "",
    isNew: true,
    notInWip: false,
  });

  const parseSemiFinishedNotes = (notes) => {
    if (!notes) return null;
    try {
      const raw = typeof notes === "string" ? notes.trim() : notes;
      if (!raw) return null;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || parsed.kind !== "semi_finished_costing") return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const matchWipItem = (recipeItem, wipList) => {
    const sku = String(recipeItem.rawMaterialSku || "").toLowerCase();
    const id = String(recipeItem.rawMaterialId || "").toLowerCase();
    const name = String(recipeItem.rawMaterialName || recipeItem.description || "").toLowerCase();
    return wipList.find((w) => {
      const wSku = String(w.sku || "").toLowerCase();
      const wId = String(w.product_id || w.id || "").toLowerCase();
      const wName = String(w.name || "").toLowerCase();
      return (
        (sku && (wSku === sku || wId === sku)) ||
        (id && (wSku === id || wId === id)) ||
        (name && wName === name)
      );
    });
  };

  /* ─── top product ───────────────────────────────────────────────────────── */
  const [selectedMixtureProduct, setSelectedMixtureProduct] = useState(null);
  const [mixtureTemplateId, setMixtureTemplateId] = useState(null);
  const [mixtureQuantity, setMixtureQuantity] = useState("");
  const [mixtureUnit, setMixtureUnit] = useState("");

  /* ─── ingredients ───────────────────────────────────────────────────────── */
  const [selectedItems, setSelectedItems] = useState([
    createEmptyIngredient(),
    createEmptyIngredient(),
  ]);

  /* ─── lists ─────────────────────────────────────────────────────────────── */
  const [semiFinishedList, setSemiFinishedList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [wipItemsList, setWipItemsList] = useState([]);
  const [loadingWipItems, setLoadingWipItems] = useState(false);

  const hydrateSemiRecipe = useCallback(
    (found, recipeItems) => {
      if (!found) return;
      if (!recipeItems?.length) {
        setSelectedItems([
          createEmptyIngredient(),
          createEmptyIngredient(),
        ]);
        return;
      }

      const hydrated = recipeItems.map((it, idx) => {
        const wip = matchWipItem(it, wipItemsList);
        const recipeQty = parseQuantityValue(it.quantity);
        const recipeUnitCost =
          typeof it.unit_cost === "number"
            ? it.unit_cost
            : parseFloat(String(it.rate || "")) || 0;

        if (wip) {
          const available = Number(
            wip.available_quantity ?? wip.available ?? wip.qty ?? 0,
          );
          const cappedQty =
            recipeQty > available && available > 0 ? available : recipeQty;
          return {
            id: Date.now() + idx,
            ...wip,
            selectedOption: wip,
            available,
            quantity: cappedQty > 0 ? String(cappedQty) : "",
            unit_cost: Number(wip.unit_cost || recipeUnitCost || 0),
            unit_of_measure:
              wip.unit_of_measure || found.unit_of_measure || "",
            isNew: false,
            notInWip: false,
          };
        }

        return {
          id: Date.now() + idx,
          name: it.rawMaterialName || it.description || "",
          sku: it.rawMaterialSku || it.rawMaterialId || "",
          selectedOption: null,
          quantity: recipeQty > 0 ? String(recipeQty) : "",
          available: 0,
          unit_cost: recipeUnitCost,
          unit_of_measure: found.unit_of_measure || "",
          isNew: false,
          notInWip: true,
        };
      });

      setSelectedItems(hydrated);
    },
    [wipItemsList],
  );

  /* ─── fetchers ──────────────────────────────────────────────────────────── */
  const fetchSemiFinishedList = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoadingProducts(true);
    _fetchApi(
      `/inventory/get-semifinshed-list?facilityId=${activeBusiness.id}`,
      (resp) => {
        setLoadingProducts(false);
        if (resp.success) {
          setSemiFinishedList(
            resp.data?.products ||
              resp.data?.items ||
              resp.results ||
              resp.data ||
              [],
          );
        } else {
          toast.error("Failed to load semi-finished products");
        }
      },
      (err) => {
        console.error(err);
        toast.error("Something went wrong fetching semi-finished list");
        setLoadingProducts(false);
      },
    );
  }, [activeBusiness?.id]);

  const fetchWipItems = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoadingWipItems(true);
    _fetchApi(
      `/inventory/wip?facilityId=${activeBusiness.id}`,
      (resp) => {
        setLoadingWipItems(false);
        if (resp.success) {
          const items = resp.data?.wipItems || [];
          setWipItemsList(
            items.map((item) => ({
              ...item,
              name: item.name || item.item_name || item.product_name || "",
              sku: item.sku || item.product_id || item.item_code || "",
              unit_of_measure: item.unit_of_measure || "",
              available: Number(
                item.available_quantity ?? item.qty ?? item.quantity ?? 0,
              ),
              unit_cost: Number(item.unit_cost || 0),
            })),
          );
        } else {
          toast.error("Failed to load WIP items");
        }
      },
      (err) => {
        console.error(err);
        toast.error("Something went wrong fetching WIP items");
        setLoadingWipItems(false);
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (isOpen && activeBusiness?.id) {
      fetchSemiFinishedList();
      fetchWipItems();
      if (selectedItems.length === 0) {
        setSelectedItems([createEmptyIngredient(), createEmptyIngredient()]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeBusiness?.id]);

  /* ─── ingredient helpers ────────────────────────────────────────────────── */
  const removeIngredient = (itemId) =>
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));

  const updateQuantity = (itemId, value) => {
    const raw = normalizeQuantityInput(value);
    if (raw === "" || raw === ".") {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, quantity: raw } : item,
        ),
      );
      return;
    }

    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num < 0) return;

    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (item.notInWip) return { ...item, quantity: raw };
        const max = Number(item.available || 0);
        if (max > 0 && num > max) {
          toast.error(`Quantity cannot exceed available stock (${max})`);
          return { ...item, quantity: String(max) };
        }
        return { ...item, quantity: raw };
      }),
    );
  };

  // Decimal-friendly quantity parsing (preserves in-progress values like "342.")
  const normalizeQuantityInput = (value) => {
    const filtered = filterJournalAmountInput(String(value || ""));
    const parsed = parseNumberFromFormatted(filtered);
    if (parsed === "" || parsed === ".") return parsed;

    const parts = parsed.split(".");
    if (parts.length > 2) {
      return `${parts[0]}.${parts.slice(1).join("").slice(0, 4)}`;
    }
    if (parts[1]?.length > 4) {
      return `${parts[0]}.${parts[1].slice(0, 4)}`;
    }
    return parsed;
  };

  const parseQuantityValue = (value) => {
    const raw = String(value ?? "").replace(/,/g, "").trim();
    if (!raw || raw === ".") return 0;
    const num = parseFloat(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const formatQtyDisplay = (value) => {
    const raw = String(value ?? "").replace(/,/g, "").trim();
    if (!raw) return "";
    return formatNumberWithCommas(raw);
  };

  const handleSelectIngredient = (itemId, wipKey) => {
    const product = wipItemsList.find((o) => getKey(o) === wipKey);
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!product) return { ...createEmptyIngredient(), id: itemId };
        const available = Number(
          product.available_quantity ?? product.available ?? product.qty ?? 0,
        );
        return {
          ...item,
          ...product,
          id: itemId,
          selectedOption: product,
          available,
          unit_cost: Number(product.unit_cost || 0),
          quantity:
            parseQuantityValue(item.quantity) > available
              ? String(available)
              : item.quantity,
          isNew: false,
          notInWip: false,
        };
      }),
    );
  };

  /* ─── auto-set mixture quantity from total ingredients ─────────────────── */
  useEffect(() => {
    const totalQty = selectedItems.reduce(
      (sum, i) => sum + parseQuantityValue(i.quantity),
      0,
    );
    if (totalQty > 0) {
      setMixtureQuantity(String(totalQty));
    }
  }, [selectedItems]);

  /* ─── cost calculations ─────────────────────────────────────────────────── */
  const totalIngredientsCost = selectedItems.reduce(
    (sum, i) =>
      sum + parseQuantityValue(i.quantity) * Number(i.unit_cost || 0),
    0,
  );
  // Unit Cost = Total Ingredients Cost / Quantity Produced
  const qtyProduced = parseQuantityValue(mixtureQuantity);
  const semiFGUnitCost =
    qtyProduced > 0 ? totalIngredientsCost / qtyProduced : 0;

  /* ─── submit ────────────────────────────────────────────────────────────── */
  const handleCreateMixture = () => {
    if (!selectedMixtureProduct) {
      toast.error("Please select a semi-finished good");
      return;
    }
    const hasDbTemplates =
      Array.isArray(selectedMixtureProduct.semi_finished_costing_templates) &&
      selectedMixtureProduct.semi_finished_costing_templates.length > 0;
    if (hasDbTemplates && !mixtureTemplateId) {
      toast.error("Please select a costing template to load ingredients");
      return;
    }
    if (!mixtureQuantity || parseQuantityValue(mixtureQuantity) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }
    const hasIncomplete = selectedItems.some((i) => i.isNew || !i.name);
    if (hasIncomplete) {
      toast.error("Please select a WIP item for all ingredient rows");
      return;
    }
    const hasUnavailable = selectedItems.some((i) => i.notInWip);
    if (hasUnavailable) {
      toast.error(
        "Some ingredients are not available in WIP. Please pick a WIP item or remove them."
      );
      return;
    }
    const hasExceeded = selectedItems.some(
      (i) => parseQuantityValue(i.quantity) > Number(i.available || 0),
    );
    if (hasExceeded) {
      toast.error("One or more ingredient quantities exceed available stock");
      return;
    }

    const payload = {
      facilityId: activeBusiness.id,
      createdBy:
        `${user?.firstname || ""} ${user?.lastname || ""}`.trim() ||
        user?.id ||
        "",
      product: {
        id: selectedMixtureProduct.id,
        sku: selectedMixtureProduct.sku || "",
        name: selectedMixtureProduct.name,
        unit_of_measure:
          selectedMixtureProduct.unit_of_measure || mixtureUnit || "",
        inventory_account: selectedMixtureProduct.inventory_account || "",
      },
      quantity: parseQuantityValue(mixtureQuantity),
      unit: mixtureUnit,
      unitCost: semiFGUnitCost,
      totalIngredientsCost,
      ingredients: selectedItems.map((i) => ({
        id: i.id,
        product_id: i.product_id || i.id || "",
        sku: i.sku || "",
        name: i.name || "",
        quantity: parseQuantityValue(i.quantity),
        unit_cost: Number(i.unit_cost || 0),
        unit_of_measure: i.unit_of_measure || "",
      })),
    };

    setSubmitting(true);
    _postApi(
      "/inventory/mixture",
      payload,
      (resp) => {
        setSubmitting(false);
        if (resp.success) {
          toast.success(
            `Mixture ${resp.data?.reference || ""} created successfully`
          );
          handleClose();
        } else {
          toast.error(resp.message || "Failed to create mixture");
        }
      },
      (err) => {
        setSubmitting(false);
        console.error("Error creating mixture:", err);
        toast.error(err?.message || "Error creating mixture");
      }
    );
  };

  const handleClose = () => {
    setSelectedMixtureProduct(null);
    setMixtureTemplateId(null);
    setMixtureQuantity("");
    setMixtureUnit("");
    setSelectedItems([createEmptyIngredient(), createEmptyIngredient()]);
    onClose();
  };

  const totalItems = selectedItems.filter((i) => !i.isNew).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto p-0 [&>button]:text-white [&>button]:opacity-90 [&>button:hover]:opacity-100 [&>button]:top-5 [&>button]:right-5">
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-[#4267B2] to-[#365899] px-6 pt-5 pb-4 rounded-t-lg">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-white text-xl font-bold">
              Create Mixture
            </DialogTitle>
          </div>
          <DialogDescription className="text-blue-100 text-sm pl-12">
            Select semi-finished items to create a new mixture
          </DialogDescription>

          {/* Valuation badge */}
          <div className="flex items-center gap-2 mt-3 pl-12">
            <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 text-white text-xs font-medium px-3 py-1 rounded-full">
              <TrendingUp className="h-3 w-3" />
              Valuation: {valuationMethod}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/25 text-white text-xs font-medium px-3 py-1 rounded-full">
              Date: {valuationDate}
            </span>
          </div>
        </div>

        <div className="px-6 py-5 grid gap-6">
          {/* ── Top row ── */}
          <div className="grid grid-cols-12 gap-4 items-end">
            {/* Semi-finished Good */}
            {/* {JSON.stringify(semiFinishedList)} */}
            <div className="col-span-6 space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Semi-finished Good <span className="text-red-500">*</span>
              </Label>
              <Select
                value={
                  selectedMixtureProduct ? getKey(selectedMixtureProduct) : ""
                }
                onValueChange={(val) => {
                  const found = semiFinishedList.find((o) => getKey(o) === val);
                  setSelectedMixtureProduct(found || null);
                  if (!found) {
                    setMixtureTemplateId(null);
                    return;
                  }
                  setMixtureUnit(found.unit_of_measure || "");
                  setMixtureTemplateId(null);

                  const multi = found.semi_finished_costing_templates;
                  if (Array.isArray(multi) && multi.length > 0) {
                    setSelectedItems([
                      createEmptyIngredient(),
                      createEmptyIngredient(),
                    ]);
                    return;
                  }

                  const fromDb = found.semi_finished_costing_items;
                  const notes = parseSemiFinishedNotes(found.notes);
                  const recipeItems =
                    Array.isArray(fromDb) && fromDb.length > 0
                      ? fromDb
                      : notes && Array.isArray(notes.items)
                        ? notes.items
                        : [];
                  hydrateSemiRecipe(found, recipeItems);
                }}
                disabled={loadingProducts}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue
                    placeholder={
                      loadingProducts
                        ? "Loading..."
                        : "Select semi-finished good..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {semiFinishedList.map((option) => (
                    <SelectItem key={getKey(option)} value={getKey(option)}>
                      {option.name}
                      {option.sku ? ` (${option.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedMixtureProduct?.semi_finished_costing_templates?.length >
                0 && (
                <div className="space-y-1 pt-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    Costing template{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={
                      mixtureTemplateId
                        ? String(mixtureTemplateId)
                        : undefined
                    }
                    onValueChange={(tid) => {
                      setMixtureTemplateId(tid);
                      const tpl =
                        selectedMixtureProduct.semi_finished_costing_templates?.find(
                          (t) => String(t.template_id) === String(tid),
                        );
                      if (tpl && selectedMixtureProduct) {
                        hydrateSemiRecipe(
                          selectedMixtureProduct,
                          tpl.items || [],
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Select a costing template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMixtureProduct.semi_finished_costing_templates.map(
                        (t) => (
                          <SelectItem
                            key={String(t.template_id)}
                            value={String(t.template_id)}
                          >
                            {t.template_name || "Recipe"}
                            {t.is_default ? " (default)" : ""}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-500">
                    Ingredients load from the template you choose.
                  </p>
                </div>
              )}

              {/* Calculated unit cost badge */}
              {selectedMixtureProduct && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-gray-500">Cost Price:</span>
                  {semiFGUnitCost > 0 ? (
                    <>
                      <span className="text-xs font-bold text-white bg-[#4267B2] px-2.5 py-0.5 rounded-full">
                        ₦{fmt(semiFGUnitCost)} / {mixtureUnit || "unit"}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      Add ingredients &amp; qty to calculate
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="col-span-3 space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Quantity <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={formatQtyDisplay(mixtureQuantity)}
                onChange={(e) =>
                  setMixtureQuantity(normalizeQuantityInput(e.target.value))
                }
                placeholder="0.0000"
                className="h-10 text-sm bg-blue-50 border-[#4267B2]/40 font-semibold"
              />
              <p className="text-[10px] text-[#4267B2] font-medium">
                Auto-filled from total ingredients
              </p>
            </div>

            {/* Unit */}
            <div className="col-span-3 space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700">
                Unit
              </Label>
              <Input
                type="text"
                value={mixtureUnit}
                onChange={(e) => setMixtureUnit(e.target.value)}
                placeholder="e.g. KG"
                className="h-10 text-sm"
              />
              <p className="text-[10px] text-[#4267B2] font-medium">
                unit of measure from semi-finished good
              </p>
            </div>
          </div>

          {/* ── Ingredients Card ── */}
          <div className="rounded-xl border border-[#4267B2]/20 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#4267B2]/8 border-b border-[#4267B2]/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#4267B2]/15 flex items-center justify-center flex-shrink-0">
                  <Settings className="h-4 w-4 text-[#4267B2]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Ingredients{" "}
                    <span className="text-[#4267B2]">(Product Specific)</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    WIP items specific to this product
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {totalItems > 0 && (
                  <span className="text-xs font-semibold text-[#4267B2] bg-[#4267B2]/10 border border-[#4267B2]/20 rounded-full px-3 py-1">
                    {totalItems} WIP item{totalItems !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#4267B2]/5 border-b border-[#4267B2]/15">
                  <tr>
                    {[
                      { label: "PRODUCT", w: "w-[38%]" },
                      { label: "UNIT COST", w: "w-[15%]" },
                      { label: "QUANTITY", w: "w-[15%]" },
                      { label: "UNIT", w: "w-[15%]" },
                      { label: "ACTION", w: "w-[15%]" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider ${col.w}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-gray-400 italic"
                      >
                        No ingredients added yet. Click &quot;Add
                        Ingredient&quot; to begin.
                      </td>
                    </tr>
                  ) : (
                    selectedItems.map((item, idx) => {
                      // const rowCost =
                      //   Number(item.quantity || 0) *
                      //   Number(item.unit_cost || 0);
                      const isLow =
                        !item.isNew &&
                        !item.notInWip &&
                        item.available > 0 &&
                        parseQuantityValue(item.quantity) > item.available * 0.8;

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-blue-50/40 transition-colors border-b border-[#4267B2]/10 ${
                            item.notInWip
                              ? "bg-red-50"
                              : idx % 2 === 0
                              ? "bg-[#4267B2]/[0.04]"
                              : "bg-white"
                          }`}
                        >
                          {/* Product */}
                          <td className="px-4 py-2.5">
                            <div className="space-y-1">
                              <Select
                                value={
                                  item.selectedOption
                                    ? getKey(item.selectedOption)
                                    : ""
                                }
                                onValueChange={(val) =>
                                  handleSelectIngredient(item.id, val)
                                }
                                disabled={loadingWipItems}
                              >
                                <SelectTrigger
                                  className={`h-9 text-xs w-full ${
                                    item.notInWip
                                      ? "border-red-400 ring-1 ring-red-200"
                                      : ""
                                  }`}
                                >
                                  <SelectValue
                                    placeholder={
                                      loadingWipItems
                                        ? "Loading WIP..."
                                        : item.notInWip
                                        ? `${item.name || "Item"} — Not available in WIP`
                                        : "Select WIP item..."
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {wipItemsList.map((option) => (
                                    <SelectItem
                                      key={getKey(option)}
                                      value={getKey(option)}
                                    >
                                      <div className="flex items-center justify-between gap-4 w-full">
                                        <span>
                                          {option.name}
                                          {option.sku ? ` (${option.sku})` : ""}
                                        </span>
                                        <span className="text-xs text-[#4267B2] font-semibold ml-2 shrink-0">
                                          Avl: {option.available ?? 0}
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {item.notInWip && (
                                <span className="inline-block text-[10px] font-semibold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded">
                                  Not available in WIP
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Unit Cost */}
                          <td className="px-4 py-2.5">
                            {item.isNew ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : (
                              <span
                                className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                                  item.notInWip
                                    ? "text-red-700 bg-red-50 border-red-200"
                                    : "text-green-700 bg-green-50 border-green-200"
                                }`}
                              >
                                ₦{fmt(item.unit_cost)}
                              </span>
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-2.5">
                            <div className="space-y-1">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={formatQtyDisplay(item.quantity)}
                                onChange={(e) =>
                                  updateQuantity(item.id, e.target.value)
                                }
                                className={`w-28 h-8 text-xs text-center ${
                                  item.notInWip
                                    ? "border-red-400 ring-1 ring-red-200"
                                    : isLow
                                    ? "border-orange-400 ring-1 ring-orange-300"
                                    : ""
                                }`}
                                placeholder="0.0000"
                                disabled={item.isNew}
                              />
                              {!item.isNew && (
                                <div
                                  className={`text-[10px] font-medium ${
                                    item.notInWip
                                      ? "text-red-500"
                                      : isLow
                                      ? "text-orange-500"
                                      : "text-gray-400"
                                  }`}
                                >
                                  {item.notInWip
                                    ? "Not in WIP"
                                    : `Avl: ${Number(item.available).toLocaleString("en-NG", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 4,
                                      })}`}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Total Cost (hidden) */}
                          {/*
                          <td className="px-4 py-2.5">
                            {item.isNew ? (
                              <span className="text-gray-300 text-xs">—</span>
                            ) : (
                              <span className="text-xs font-bold text-[#4267B2] bg-blue-50 border border-blue-100 px-2 py-1 rounded-md">
                                ₦{fmt(rowCost)}
                              </span>
                            )}
                          </td>
                          */}

                          {/* Unit */}
                          <td className="px-4 py-2.5">
                            {item.unit_of_measure ? (
                              <span className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded">
                                {item.unit_of_measure}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="px-4 py-2.5">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeIngredient(item.id)}
                              className="h-7 px-2.5 flex items-center gap-1 text-xs"
                            >
                              <Trash2 className="h-3 w-3" />
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Cost summary row (hidden) */}
                {/*
                {totalItems > 0 && (
                  <tfoot>
                    <tr className="bg-[#4267B2]/8 border-t-2 border-[#4267B2]/20">
                      <td
                        colSpan={3}
                        className="px-4 py-2.5 text-right text-xs font-bold text-gray-600"
                      >
                        Total Ingredients Cost
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-bold text-[#4267B2]">
                          ₦{fmt(totalIngredientsCost)}
                        </span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
                */}
              </table>
            </div>
          </div>

          {/* Cost summary card (hidden) */}
          {/*
          {selectedMixtureProduct && totalItems > 0 && (
            <div className="bg-[#4267B2]/5 border border-[#4267B2]/20 rounded-xl px-5 py-4">
              <p className="text-xs font-semibold text-[#4267B2] uppercase tracking-wide mb-3">
                Cost Summary
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">
                    Total Ingredients Cost
                  </p>
                  <p className="text-base font-bold text-green-700">
                    ₦{fmt(totalIngredientsCost)}
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Qty Produced</p>
                  <p className="text-base font-bold text-gray-800">
                    {qtyProduced} {mixtureUnit || "units"}
                  </p>
                </div>
                <div className="bg-[#4267B2] rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-blue-200 mb-1">
                    Semi-finished Cost Price
                  </p>
                  <p className="text-base font-bold text-white">
                    ₦{fmt(semiFGUnitCost)}
                    <span className="text-xs font-normal text-blue-200 ml-1">
                      / {mixtureUnit || "unit"}
                    </span>
                  </p>
                  <p className="text-[10px] text-blue-200 mt-0.5">
                    {fmt(totalIngredientsCost)} ÷ {qtyProduced}
                  </p>
                </div>
              </div>
            </div>
          )}
          */}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50 rounded-b-lg">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateMixture}
            disabled={
              submitting ||
              !selectedMixtureProduct ||
              !mixtureQuantity ||
              selectedItems.length === 0
            }
            className="bg-[#4267B2] hover:bg-[#365899] text-white"
          >
            {submitting ? "Creating..." : "Create Mixture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MixtureModal;
