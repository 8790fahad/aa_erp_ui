import { Input, Modal, Select as AntSelect } from "antd";
import { toast } from "sonner";
import {
  MoreVerticalIcon,
  Upload,
  Plus,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Package,
  DollarSign,
  ImageIcon,
  FileText,
  Target,
  Ban,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import ProductsUpload from "./ProductsUpload";
import {
  normalizeTaxableStatus,
  TAXABLE_STATUS_OPTIONS,
  taxableStatusStyle,
} from "@/utils/taxableStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiURL, _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";

const legacySalesTargetFromProduct = (item) => {
  if (!item) return { period: "none", quantity: "" };
  if (item.daily_sales_limit)
    return { period: "daily", quantity: String(item.daily_sales_limit) };
  if (item.weekly_sales_limit)
    return { period: "weekly", quantity: String(item.weekly_sales_limit) };
  if (item.monthly_sales_limit)
    return { period: "monthly", quantity: String(item.monthly_sales_limit) };
  return { period: "none", quantity: "" };
};

const warehouseTargetsFromProduct = (item) =>
  Array.isArray(item?.sales_targets) ? item.sales_targets : [];

const warehouseStopsFromProduct = (item) =>
  Array.isArray(item?.sales_stops) ? item.sales_stops : [];

const displayStopsForProduct = (item, allBranches = []) => {
  const stops = warehouseStopsFromProduct(item);
  if (stops.length) return stops;
  if (item?.sales_stopped) {
    return (allBranches || []).map((b) => ({
      branch_id: b.id,
      branch_name: b.branch_name || `Warehouse ${b.id}`,
    }));
  }
  return [];
};

const displayTargetsForProduct = (item) => {
  const warehouse = warehouseTargetsFromProduct(item);
  if (warehouse.length) return warehouse;
  const legacy = legacySalesTargetFromProduct(item);
  if (legacy.period === "none") return [];
  return [{ branch_id: "legacy", branch_name: "", ...legacy }];
};

const EMPTY_SALES_TARGET_MODAL = {
  open: false,
  productId: null,
  productName: "",
  period: "daily",
  quantity: "",
  quantities: {},
  periods: {},
  branchIds: [],
  sales_targets: [],
  legacyPeriod: "none",
  legacyQuantity: "",
};

const SALES_TARGET_PERIOD_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const EMPTY_STOP_SALES_MODAL = {
  open: false,
  productId: null,
  productName: "",
  branchIds: [],
  sales_stops: [],
  legacyStopped: false,
};

const ONLINE_ELIGIBLE_ITEM_TYPES = [
  "Resalable",
  "Service",
  "Finished Good",
  "By-Product",
];

/** Goods = stocked sellable items (Resalable / Finished Good / By-Product) */
const isGoodsItemType = (itemType) =>
  ["Resalable", "Finished Good", "By-Product"].includes(itemType);

/** Products & Services list: Goods + Service only (hide Raw Material / WIP types). */
const isProductListItemType = (itemType) =>
  isGoodsItemType(itemType) || itemType === "Service";

const resolveProductImageUrl = (src) => {
  if (!src) return "";
  const trimmed = String(src).trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:"))
    return trimmed;

  const uploadsIndex = trimmed.indexOf("/public/uploads/");
  if (uploadsIndex !== -1) {
    const uploadPath = trimmed.slice(uploadsIndex);
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const stored = new URL(trimmed);
        const api = new URL(apiURL);
        if (
          stored.host === api.host ||
          stored.hostname === "localhost" ||
          stored.hostname === "127.0.0.1"
        ) {
          return `${api.origin}${api.pathname.replace(/\/$/, "")}${uploadPath}`;
        }
      } catch {
        return trimmed;
      }
    }
    return `${apiURL}${uploadPath}`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const apiOrigin = apiURL.replace(
    /\/(aa_erp|aa_erp|aa_erp_api|aa_erp_api)\/?$/,
    "",
  );

  if (
    trimmed.startsWith("/aa_erp/") ||
    trimmed.startsWith("/aa_erp/") ||
    trimmed.startsWith("/aa_erp_api/") ||
    trimmed.startsWith("/aa_erp_api/")
  ) {
    return `${apiOrigin}${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `${apiURL}${trimmed}`;
  }

  return trimmed;
};

const isOnlineEligible = (itemType) =>
  ONLINE_ELIGIBLE_ITEM_TYPES.includes(itemType);

const compareText = (a, b) =>
  String(a || "").localeCompare(String(b || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

function WarehouseStatusBadge({
  item,
  branches,
  onToggleStop,
  togglingKey,
  onEditTargets,
}) {
  const stops = displayStopsForProduct(item, branches);
  const targets = displayTargetsForProduct(item);
  if (!stops.length && !targets.length) return null;

  const stoppedIds = new Set(stops.map((s) => String(s.branch_id)));
  const rows = branches.length
    ? branches
    : stops.map((s) => ({
        id: s.branch_id,
        branch_name: s.branch_name,
      }));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 shadow-sm hover:bg-slate-50"
          title="View stop sales and targets by store"
        >
          {stops.length ? (
            <span className="inline-flex items-center gap-1 text-red-600">
              <Ban className="h-3.5 w-3.5" />
              <span className="sr-only">Sales stopped</span>
              <span className="text-xs font-semibold text-slate-600">
                +{stops.length}
              </span>
            </span>
          ) : null}
          {stops.length && targets.length ? (
            <span className="h-3 w-px bg-slate-200" />
          ) : null}
          {targets.length ? (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Target className="h-3.5 w-3.5" />
              <span className="sr-only">Sales target</span>
              <span className="text-xs font-semibold text-slate-600">
                +{targets.length}
              </span>
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {stops.length ? (
          <>
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">
                Stop sales by warehouse
              </p>
              <p className="text-[11px] text-slate-500">
                On blocks invoices at that store. Off resumes sales.
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {rows.map((b) => {
                const id = String(b.id);
                const stopped = stoppedIds.has(id);
                const busy = togglingKey === `${item.id}-${id}`;
                return (
                  <div
                    key={`stop-${id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-800">
                      {b.branch_name || `Warehouse ${b.id}`}
                    </span>
                    <Switch
                      checked={stopped}
                      disabled={busy}
                      onCheckedChange={(on) => onToggleStop(item, id, on)}
                      className="data-[state=checked]:bg-red-600"
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
        {targets.length ? (
          <>
            <div
              className={`border-b border-slate-100 px-3 py-2 ${
                stops.length ? "border-t" : ""
              }`}
            >
              <p className="text-xs font-semibold text-slate-700">
                Sales targets
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              {targets.map((t, i) => (
                <div
                  key={`${t.branch_id}-${t.period}-${i}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-slate-800">
                    {t.branch_name || "All warehouses"}
                  </span>
                  <span className="text-amber-800">
                    {formatNumber1(t.quantity)}/{t.period}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-3 py-2">
              <button
                type="button"
                className="text-xs font-medium text-[var(--aa-accent)] hover:underline"
                onClick={onEditTargets}
              >
                Edit targets
              </button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function SortTh({ label, column, sortKey, sortDir, onSort, align = "left" }) {
  const active = sortKey === column;
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 ${
          align === "right" ? "w-full justify-end" : ""
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

export default function ProductList() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(
    1,
    parseInt(searchParams.get("page") || "1", 10),
  );
  const pageSizeFromUrl = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10)),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showGrouping, setShowGrouping] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    productId: null,
    productName: "",
  });
  const [deleting, setDeleting] = useState(false);
  const [priceModal, setPriceModal] = useState({
    open: false,
    productId: null,
    productName: "",
    sellingPrice: "",
  });
  const [savingPrice, setSavingPrice] = useState(false);
  const [imagesModal, setImagesModal] = useState({
    open: false,
    productId: null,
    productName: "",
    images: [],
  });
  const [savingImages, setSavingImages] = useState(false);
  const [descriptionModal, setDescriptionModal] = useState({
    open: false,
    productId: null,
    productName: "",
    description: "",
  });
  const [savingDescription, setSavingDescription] = useState(false);
  const [salesTargetModal, setSalesTargetModal] = useState(
    EMPTY_SALES_TARGET_MODAL,
  );
  const [savingSalesTarget, setSavingSalesTarget] = useState(false);
  const [stopSalesModal, setStopSalesModal] = useState(EMPTY_STOP_SALES_MODAL);
  const [savingStopSales, setSavingStopSales] = useState(false);
  const [togglingStopKey, setTogglingStopKey] = useState(null);
  const [branches, setBranches] = useState([]);

  const handlePageChange = useCallback(
    (page) => {
      setSearchParams(
        (prev) => {
          const currentPage = Math.max(
            1,
            parseInt(prev.get("page") || "1", 10),
          );
          if (page === currentPage) return prev;
          const next = new URLSearchParams(prev);
          next.set("page", String(page));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handlePageSizeChange = useCallback(
    (size) => {
      setSearchParams(
        (prev) => {
          const currentSize = Math.max(
            1,
            Math.min(100, parseInt(prev.get("pageSize") || "10", 10)),
          );
          if (size === currentSize) return prev;
          const next = new URLSearchParams(prev);
          next.set("pageSize", String(size));
          next.set("page", "1");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    const next = new URLSearchParams(searchParams);
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const handleCategoryFilterChange = (value) => {
    setCategoryFilter(value || "");
    const next = new URLSearchParams(searchParams);
    next.set("page", "1");
    setSearchParams(next, { replace: true });
  };

  const handleSort = (column) => {
    if (sortKey === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir("asc");
  };

  const getProductImages = (item) => {
    if (Array.isArray(item?.product_images)) {
      return item.product_images.filter(Boolean);
    }
    if (
      typeof item?.product_images === "string" &&
      item.product_images.trim()
    ) {
      try {
        const parsed = JSON.parse(item.product_images);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
      } catch {
        return [item.product_images];
      }
    }
    return item?.image_url ? [item.image_url] : [];
  };

  const getPrimaryImage = (item) => {
    const images = getProductImages(item);
    return item?.image_url || images[0] || null;
  };

  const getInventory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);

    // Use the ORM-based products API
    fetch(`${apiURL}/api/products?facilityId=${activeBusiness.id}`)
      .then((response) => response.json())
      .then((resp) => {
        if (resp.success) {
          setData(resp.data || []);
        } else {
          toast.error("Failed to load products.");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
        setLoading(false);
      });
  }, [activeBusiness?.id]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (resp) => {
        const rows = resp?.results || resp?.data || resp || [];
        setBranches(Array.isArray(rows) ? rows : []);
      },
      () => setBranches([]),
    );
  }, [activeBusiness?.id]);

  const updateTaxableStatus = async (productId, newTaxable) => {
    if (!activeBusiness?.id) return;

    const resolved = normalizeTaxableStatus(newTaxable, "Taxable");

    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/taxable`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taxable: resolved,
            facilityId: activeBusiness.id,
          }),
        },
      );

      const resp = await response.json();

      if (resp.success) {
        setData((prevData) =>
          prevData.map((item) =>
            item.id === productId ? { ...item, taxable: resolved } : item,
          ),
        );
        toast.success(`Product marked as ${resolved}`);
      } else {
        toast.error(resp.message || "Failed to update taxable status");
      }
    } catch (err) {
      console.error("API Error:", err);
      toast.error("Something went wrong while updating taxable status");
    }
  };

  const updateOnlineStatus = async (productId, currentOnline, itemType) => {
    if (!activeBusiness?.id) return;

    const newOnline = !(
      currentOnline === true ||
      currentOnline === "true" ||
      currentOnline === 1
    );

    if (newOnline && !isOnlineEligible(itemType)) {
      toast.error("Online is only available for Goods and Service items");
      return;
    }

    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/online`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            online_enabled: newOnline,
            facilityId: activeBusiness.id,
          }),
        },
      );

      const resp = await response.json();

      if (resp.success) {
        setData((prevData) =>
          prevData.map((item) =>
            item.id === productId
              ? { ...item, online_enabled: newOnline }
              : item,
          ),
        );
        toast.success(`Product marked ${newOnline ? "Online" : "Offline"}`);
      } else {
        toast.error(resp.message || "Failed to update online status");
      }
    } catch (err) {
      console.error("API Error:", err);
      toast.error("Something went wrong while updating online status");
    }
  };

  const toggleProductStatus = async (productId, currentStatus) => {
    if (!activeBusiness?.id) return;
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facilityId: activeBusiness.id }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        const newStatus = resp.data.status;
        setData((prev) =>
          prev.map((item) =>
            item.id === productId ? { ...item, status: newStatus } : item,
          ),
        );
        toast.success(`Product marked as ${newStatus}`);
      } else {
        toast.error(resp.message || "Failed to update status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating status");
    }
  };

  const openDeleteModal = (productId, productName) => {
    setDeleteModal({ open: true, productId, productName });
  };

  const openPriceModal = (item) => {
    setPriceModal({
      open: true,
      productId: item.id,
      productName: item.name,
      sellingPrice:
        item.selling_price != null && item.selling_price !== ""
          ? String(item.selling_price)
          : "",
    });
  };

  const openSalesTargetModal = (item) => {
    const sales_targets = warehouseTargetsFromProduct(item);
    const legacy = legacySalesTargetFromProduct(item);
    const existingIds = sales_targets
      .map((t) => String(t.branch_id))
      .filter(Boolean);
    const quantities = {};
    const periods = {};
    for (const t of sales_targets) {
      if (t.branch_id == null) continue;
      const id = String(t.branch_id);
      quantities[id] = String(t.quantity ?? "");
      periods[id] = t.period || "daily";
    }
    const samePeriod =
      sales_targets.length > 0 &&
      sales_targets.every((t) => t.period === sales_targets[0].period);
    const sameQty =
      sales_targets.length > 0 &&
      sales_targets.every(
        (t) => String(t.quantity) === String(sales_targets[0].quantity),
      );
    const first = sales_targets[0];
    setSalesTargetModal({
      open: true,
      productId: item.id,
      productName: item.name,
      period: samePeriod
        ? first.period
        : existingIds.length
          ? first?.period || "daily"
          : legacy.period === "none"
            ? "daily"
            : legacy.period,
      quantity: sameQty
        ? String(first.quantity ?? "")
        : existingIds.length
          ? ""
          : legacy.quantity,
      quantities,
      periods,
      branchIds: existingIds,
      sales_targets,
      legacyPeriod: legacy.period,
      legacyQuantity: legacy.quantity,
    });
  };

  const toggleSalesTargetWarehouse = (branchId) => {
    const id = String(branchId);
    setSalesTargetModal((prev) => {
      const selected = prev.branchIds || [];
      const nextIds = selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id];
      const quantities = { ...(prev.quantities || {}) };
      const periods = { ...(prev.periods || {}) };
      if (!selected.includes(id)) {
        if (quantities[id] == null || quantities[id] === "") {
          quantities[id] = prev.quantity || "";
        }
        if (!periods[id] || periods[id] === "none") {
          periods[id] = prev.period && prev.period !== "none" ? prev.period : "daily";
        }
      }
      return { ...prev, branchIds: nextIds, quantities, periods };
    });
  };

  const toggleAllSalesTargetWarehouses = () => {
    const allIds = branches.map((b) => String(b.id));
    setSalesTargetModal((prev) => {
      const selected = prev.branchIds || [];
      const allOn =
        allIds.length > 0 && allIds.every((id) => selected.includes(id));
      if (allOn) return { ...prev, branchIds: [] };
      const quantities = { ...(prev.quantities || {}) };
      const periods = { ...(prev.periods || {}) };
      const fillQty = prev.quantity || "";
      const fillPeriod =
        prev.period && prev.period !== "none" ? prev.period : "daily";
      for (const id of allIds) {
        if (fillQty && (quantities[id] == null || quantities[id] === "")) {
          quantities[id] = fillQty;
        }
        if (!periods[id] || periods[id] === "none") {
          periods[id] = fillPeriod;
        }
      }
      return { ...prev, branchIds: allIds, quantities, periods };
    });
  };

  const applySalesTargetToAll = ({ quantity, period } = {}) => {
    setSalesTargetModal((prev) => {
      const nextPeriod = period !== undefined ? period : prev.period;
      const nextQty = quantity !== undefined ? quantity : prev.quantity;
      if (nextPeriod === "none") {
        return { ...prev, period: "none", quantity: nextQty };
      }
      const selected = (prev.branchIds || []).length
        ? prev.branchIds
        : branches.map((b) => String(b.id));
      const quantities = { ...(prev.quantities || {}) };
      const periods = { ...(prev.periods || {}) };
      for (const id of selected) {
        if (quantity !== undefined) quantities[id] = nextQty;
        if (period !== undefined) periods[id] = nextPeriod;
        if (!periods[id] || periods[id] === "none") periods[id] = nextPeriod;
      }
      return {
        ...prev,
        period: nextPeriod,
        quantity: nextQty,
        branchIds: selected,
        quantities,
        periods,
      };
    });
  };

  const setSalesTargetQuantity = (branchId, value) => {
    const id = String(branchId);
    setSalesTargetModal((prev) => ({
      ...prev,
      quantities: { ...(prev.quantities || {}), [id]: value },
    }));
  };

  const setSalesTargetPeriod = (branchId, value) => {
    const id = String(branchId);
    setSalesTargetModal((prev) => ({
      ...prev,
      periods: { ...(prev.periods || {}), [id]: value },
    }));
  };

  const saveSalesTarget = async () => {
    const { productId, period, quantities, periods, branchIds } =
      salesTargetModal;
    if (!activeBusiness?.id || !productId) return;

    const targets =
      period === "none"
        ? []
        : (branchIds || []).map((id) => ({
            branchId: id,
            quantity: String(quantities?.[id] ?? "").replace(/,/g, ""),
            period: periods?.[id] || period || "daily",
          }));

    if (period !== "none") {
      if (!targets.length) {
        toast.error("Select at least one warehouse");
        return;
      }
      const invalid = targets.find((t) => {
        const qty = parseInt(t.quantity, 10);
        return !Number.isFinite(qty) || qty <= 0;
      });
      if (invalid) {
        toast.error("Enter a valid quantity for each selected warehouse");
        return;
      }
    }

    setSavingSalesTarget(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/sales-target`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            period,
            targets,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        setData((prev) =>
          prev.map((row) =>
            row.id === productId
              ? {
                  ...row,
                  sales_targets: resp.data.sales_targets || [],
                }
              : row,
          ),
        );
        setSalesTargetModal(EMPTY_SALES_TARGET_MODAL);
        toast.success(
          period === "none" || !targets.length
            ? "Sales targets cleared"
            : `Sales targets saved for ${targets.length} warehouse${
                targets.length === 1 ? "" : "s"
              }`,
        );
      } else {
        toast.error(resp.message || "Failed to update sales target");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating sales target");
    } finally {
      setSavingSalesTarget(false);
    }
  };

  const openStopSalesModal = (item) => {
    const sales_stops = warehouseStopsFromProduct(item);
    const existingIds = sales_stops
      .map((s) => String(s.branch_id))
      .filter(Boolean);
    const legacyStopped = !!item.sales_stopped && existingIds.length === 0;
    setStopSalesModal({
      open: true,
      productId: item.id,
      productName: item.name,
      branchIds: legacyStopped
        ? branches.map((b) => String(b.id))
        : existingIds,
      sales_stops,
      legacyStopped,
    });
  };

  const toggleStopSalesWarehouse = (branchId) => {
    const id = String(branchId);
    setStopSalesModal((prev) => {
      const selected = prev.branchIds || [];
      const nextIds = selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id];
      return { ...prev, branchIds: nextIds };
    });
  };

  const toggleAllStopSalesWarehouses = () => {
    const allIds = branches.map((b) => String(b.id));
    setStopSalesModal((prev) => {
      const selected = prev.branchIds || [];
      const allOn =
        allIds.length > 0 && allIds.every((id) => selected.includes(id));
      return { ...prev, branchIds: allOn ? [] : allIds };
    });
  };

  const persistStopSales = async (productId, branchIds) => {
    if (!activeBusiness?.id || !productId) return false;
    const response = await fetch(
      `${apiURL}/api/products/${productId}/stop-sales`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: activeBusiness.id,
          branchIds,
        }),
      },
    );
    const resp = await response.json();
    if (!resp.success) {
      toast.error(resp.message || "Failed to update stop sales");
      return false;
    }
    setData((prev) =>
      prev.map((row) =>
        row.id === productId
          ? {
              ...row,
              sales_stops: resp.data.sales_stops || [],
              sales_stopped: false,
            }
          : row,
      ),
    );
    return true;
  };

  const setWarehouseStopped = async (item, branchId, stopped) => {
    const id = String(branchId);
    const current = displayStopsForProduct(item, branches).map((s) =>
      String(s.branch_id),
    );
    const next = stopped
      ? [...new Set([...current, id])]
      : current.filter((x) => x !== id);
    setTogglingStopKey(`${item.id}-${id}`);
    try {
      const ok = await persistStopSales(item.id, next);
      if (ok) {
        const name =
          branches.find((b) => String(b.id) === id)?.branch_name ||
          "this warehouse";
        toast.success(
          stopped ? `Sales stopped at ${name}` : `Sales resumed at ${name}`,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating stop sales");
    } finally {
      setTogglingStopKey(null);
    }
  };

  const saveStopSales = async () => {
    const { productId, branchIds } = stopSalesModal;
    if (!activeBusiness?.id || !productId) return;

    setSavingStopSales(true);
    try {
      const ok = await persistStopSales(productId, branchIds);
      if (ok) {
        setStopSalesModal(EMPTY_STOP_SALES_MODAL);
        const names = branches
          .filter((b) => branchIds.includes(String(b.id)))
          .map((b) => b.branch_name || `Warehouse ${b.id}`);
        const where =
          names.length === 0
            ? "all warehouses"
            : names.length <= 2
              ? names.join(" and ")
              : `${names.length} warehouses`;
        toast.success(
          names.length
            ? `Sales stopped at ${where}`
            : `Sales resumed at ${where}`,
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating stop sales");
    } finally {
      setSavingStopSales(false);
    }
  };

  const saveProductPrice = async () => {
    const { productId, sellingPrice } = priceModal;
    if (!activeBusiness?.id || !productId) return;

    const price = parseFloat(String(sellingPrice).replace(/,/g, ""));
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setSavingPrice(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/price`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            selling_price: price,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        setData((prev) =>
          prev.map((item) =>
            item.id === productId ? { ...item, selling_price: price } : item,
          ),
        );
        toast.success("Product price updated");
        setPriceModal({
          open: false,
          productId: null,
          productName: "",
          sellingPrice: "",
        });
      } else {
        toast.error(resp.message || "Failed to update price");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating price");
    } finally {
      setSavingPrice(false);
    }
  };

  const openImagesModal = (item) => {
    setImagesModal({
      open: true,
      productId: item.id,
      productName: item.name,
      images: getProductImages(item),
    });
  };

  const handleAddProductImages = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const validFiles = files.filter((file) => {
      if (!file.type?.startsWith("image/")) {
        toast.error(`${file.name} is not a valid image`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    Promise.all(
      validFiles.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((newImages) => {
        setImagesModal((prev) => ({
          ...prev,
          images: [...prev.images, ...newImages.filter(Boolean)],
        }));
        toast.success(
          `${newImages.filter(Boolean).length} image${newImages.filter(Boolean).length === 1 ? "" : "s"} added`,
        );
      })
      .catch(() => toast.error("Failed to read image files"));
  };

  const removeProductImage = (index) => {
    setImagesModal((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const saveProductImages = async () => {
    const { productId, images } = imagesModal;
    if (!activeBusiness?.id || !productId) return;

    setSavingImages(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/images`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            product_images: images,
            image_url: images[0] || null,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        const updatedImages = resp.data?.product_images || images;
        const primaryImage = resp.data?.image_url || updatedImages[0] || null;
        setData((prev) =>
          prev.map((item) =>
            item.id === productId
              ? {
                  ...item,
                  product_images: updatedImages,
                  image_url: primaryImage,
                }
              : item,
          ),
        );
        toast.success("Product images updated");
        setImagesModal({
          open: false,
          productId: null,
          productName: "",
          images: [],
        });
      } else {
        toast.error(resp.message || "Failed to update images");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating images");
    } finally {
      setSavingImages(false);
    }
  };

  const openDescriptionModal = (item) => {
    setDescriptionModal({
      open: true,
      productId: item.id,
      productName: item.name,
      description: item.marketplace_description || "",
    });
  };

  const saveProductDescription = async () => {
    const { productId, description } = descriptionModal;
    if (!activeBusiness?.id || !productId) return;

    setSavingDescription(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}/description`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            facilityId: activeBusiness.id,
            marketplace_description: description,
          }),
        },
      );
      const resp = await response.json();
      if (resp.success) {
        const updatedDescription = resp.data?.marketplace_description || "";
        setData((prev) =>
          prev.map((item) =>
            item.id === productId
              ? { ...item, marketplace_description: updatedDescription }
              : item,
          ),
        );
        toast.success("Product description updated");
        setDescriptionModal({
          open: false,
          productId: null,
          productName: "",
          description: "",
        });
      } else {
        toast.error(resp.message || "Failed to update description");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while updating description");
    } finally {
      setSavingDescription(false);
    }
  };

  const confirmDeleteProduct = async () => {
    const { productId } = deleteModal;
    if (!activeBusiness?.id || !productId) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `${apiURL}/api/products/${productId}?facilityId=${activeBusiness.id}`,
        { method: "DELETE" },
      );
      const resp = await response.json();
      if (resp.success) {
        setData((prev) => prev.filter((item) => item.id !== productId));
        toast.success("Product deleted successfully");
        setDeleteModal({ open: false, productId: null, productName: "" });
      } else {
        toast.error(resp.message || "Failed to delete product");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong while deleting product");
    } finally {
      setDeleting(false);
    }
  };

  const createProductGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedProducts.length === 0) {
      toast.error("Please select at least one product");
      return;
    }

    try {
      const response = await fetch(`${apiURL}/api/product-groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          facilityId: activeBusiness.id,
          name: groupName,
          productIds: selectedProducts,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Product group created successfully");
        setGroupModalOpen(false);
        setGroupName("");
        setSelectedProducts([]);
        setShowGrouping(false);
        getInventory(); // Refresh the data
      } else {
        toast.error(result.message || "Failed to create product group");
      }
    } catch (error) {
      console.error("Error creating product group:", error);
      toast.error("Something went wrong while creating product group");
    }
  };

  const handleProductSelection = (productId, isSelected) => {
    if (isSelected) {
      setSelectedProducts((prev) => [...prev, productId]);
    } else {
      setSelectedProducts((prev) => prev.filter((id) => id !== productId));
    }
  };

  const toggleSelectAll = () => {
    const finishedGoods = filteredData.filter(
      (item) => item.item_type === "Finished Good",
    );
    if (selectedProducts.length === finishedGoods.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(finishedGoods.map((item) => item.id));
    }
  };

  useEffect(() => {
    getInventory();
  }, [getInventory]);

  const catalogData = useMemo(
    () => data.filter((item) => isProductListItemType(item.item_type)),
    [data],
  );

  const displayItemType = (itemType) => {
    if (itemType === "Service") return "Service";
    if (isGoodsItemType(itemType)) return "Goods";
    return itemType || "—";
  };

  const categoryOptions = useMemo(() => {
    const names = new Set();
    let hasUncategorized = false;
    for (const item of catalogData) {
      const name = String(item.category || "").trim();
      if (name) names.add(name);
      else hasUncategorized = true;
    }
    const options = [...names]
      .sort(compareText)
      .map((name) => ({ value: name, label: name }));
    if (hasUncategorized) {
      options.unshift({ value: "__none__", label: "Uncategorized" });
    }
    return options;
  }, [catalogData]);

  const filteredData = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const rows = catalogData.filter((item) => {
      const typeLabel = displayItemType(item.item_type);
      const matchesSearch =
        !searchLower ||
        item.name?.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower) ||
        item.item_type?.toLowerCase().includes(searchLower) ||
        typeLabel?.toLowerCase().includes(searchLower);

      const matchesItemType =
        !itemTypeFilter || item.item_type === itemTypeFilter;

      const categoryName = String(item.category || "").trim();
      const matchesCategory =
        !categoryFilter ||
        (categoryFilter === "__none__"
          ? !categoryName
          : categoryName === categoryFilter);

      return matchesSearch && matchesItemType && matchesCategory;
    });

    const dir = sortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "category":
          cmp = compareText(a.category, b.category);
          break;
        case "type":
          cmp = compareText(
            displayItemType(a.item_type),
            displayItemType(b.item_type),
          );
          break;
        case "unit":
          cmp = compareText(a.unit_of_measure, b.unit_of_measure);
          break;
        case "selling_price":
          cmp = (Number(a.selling_price) || 0) - (Number(b.selling_price) || 0);
          break;
        case "status":
          cmp = compareText(a.status, b.status);
          break;
        case "tax":
          cmp = compareText(
            normalizeTaxableStatus(a.taxable, "Taxable"),
            normalizeTaxableStatus(b.taxable, "Taxable"),
          );
          break;
        case "name":
        default:
          cmp = compareText(a.name, b.name);
          break;
      }
      return cmp * dir;
    });

    return rows;
  }, [
    catalogData,
    searchTerm,
    itemTypeFilter,
    categoryFilter,
    sortKey,
    sortDir,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / pageSizeFromUrl),
  );

  useEffect(() => {
    if (pageFromUrl > totalPages) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", String(totalPages));
          return next;
        },
        { replace: true },
      );
    }
  }, [pageFromUrl, totalPages, setSearchParams]);

  const pageItems = useMemo(() => {
    const startIdx = (pageFromUrl - 1) * pageSizeFromUrl;
    return filteredData.slice(startIdx, startIdx + pageSizeFromUrl);
  }, [filteredData, pageFromUrl, pageSizeFromUrl]);

  const renderRowActions = (item) => (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/app/inventory/product-list/view/${item.id}`)}
        className="h-8 w-8 p-0 text-[var(--aa-accent)] hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-accent-hover)]"
        title="View"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/app/inventory/product-list/edit/${item.id}`)}
        className="h-8 w-8 p-0 text-[var(--aa-navy)] hover:bg-[var(--aa-sidebar-active)]"
        title="Edit"
      >
        <Edit className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-500 hover:bg-[var(--aa-sidebar-active)] hover:text-[var(--aa-navy)]"
            title="More"
          >
            <MoreVerticalIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => openPriceModal(item)}
            className="flex items-center gap-2"
          >
            <DollarSign className="h-4 w-4" />
            Set Price
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openSalesTargetModal(item)}
            className="flex items-center gap-2"
          >
            <Target className="h-4 w-4" />
            Set Sales Target
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openImagesModal(item)}
            className="flex items-center gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            Product Images
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDescriptionModal(item)}
            className="flex items-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Add Description
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => openStopSalesModal(item)}
            className="flex items-center gap-2"
          >
            <Ban className="h-4 w-4 text-red-600" />
            Stop Sales
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toggleProductStatus(item.id, item.status)}
            className="flex items-center gap-2"
          >
            <div
              className={`h-2 w-2 rounded-full ${
                item.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
              }`}
            />
            {item.status === "Active" ? "Mark Inactive" : "Mark Active"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => openDeleteModal(item.id, item.name)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete Product
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Product & Service Inventory
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Total :{" "}
              <span className="font-semibold text-gray-900">
                {catalogData.length}
              </span>
            </span>
            <span className="text-sm text-gray-600">
              Goods:{" "}
              <span className="font-semibold text-green-600">
                {
                  catalogData.filter((item) => isGoodsItemType(item.item_type))
                    .length
                }
              </span>
            </span>
            <span className="text-sm text-gray-600">
              Service:{" "}
              <span className="font-semibold text-[var(--aa-navy)]">
                {
                  catalogData.filter((item) => item.item_type === "Service")
                    .length
                }
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, SKU, category, or type..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <AntSelect
            allowClear
            showSearch
            placeholder="All categories"
            className="w-full sm:w-56"
            value={categoryFilter || undefined}
            onChange={handleCategoryFilterChange}
            optionFilterProp="label"
            options={categoryOptions}
          />
          <Button
            type="button"
            className="aa-btn-primary h-10 px-5 text-white"
            onClick={() => navigate(`/app/inventory/product-list/new`)}
          >
            <Plus className="w-5 h-5" />
            Add Product/Service
          </Button>
          <Button
            type="button"
            className="aa-btn-primary h-10 px-5 text-white"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="w-5 h-5" />
            Bulk Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4"
            onClick={() => getInventory()}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

      <ProductsUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        getInventory={getInventory}
      />

      {/* Products Table Section */}
      <div className="">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm || categoryFilter
                ? "No products found"
                : "No products yet"}
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {searchTerm || categoryFilter
                ? "No products match your search or category filter."
                : "Get started by adding your first product or service to manage your inventory."}
            </p>
            {!searchTerm && !categoryFilter && (
              <Button
                type="button"
                className="aa-btn-primary mx-auto h-10 px-5 text-white"
                onClick={() => navigate(`/app/inventory/product-list/new`)}
              >
                <Plus className="w-5 h-5" />
                Add Your First Product/Service
              </Button>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <th className="w-12 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      #
                    </th>
                    <SortTh
                      label="Product"
                      column="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Category"
                      column="category"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Type"
                      column="type"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Unit"
                      column="unit"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Selling Price"
                      column="selling_price"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      align="right"
                    />
                    <SortTh
                      label="Status"
                      column="status"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Tax"
                      column="tax"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                    />
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item, idx) => {
                    const primaryImage = getPrimaryImage(item);
                    const taxableValue = normalizeTaxableStatus(
                      item.taxable,
                      "Taxable",
                    );
                    const taxStyle = taxableStatusStyle(taxableValue);
                    const typeLabel = displayItemType(item.item_type);
                    const rowNum =
                      (pageFromUrl - 1) * pageSizeFromUrl + idx + 1;

                    return (
                      <tr
                        key={item.id || item.sku || rowNum}
                        className="border-b border-slate-100 transition-colors last:border-0 hover:bg-[var(--aa-sidebar-active)]/60"
                      >
                        <td className="px-4 py-3 align-middle text-slate-400">
                          {rowNum}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            {primaryImage ? (
                              <img
                                src={resolveProductImageUrl(primaryImage)}
                                alt={item.name}
                                className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--aa-sidebar-bg)]">
                                <Package className="h-4 w-4 text-slate-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[var(--aa-navy)]">
                                {item.name}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {item.sku || "No SKU"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-700">
                          {String(item.category || "").trim() || (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                              typeLabel === "Service"
                                ? "bg-[var(--aa-sidebar-bg)] text-[var(--aa-navy)]"
                                : "bg-[var(--aa-sidebar-active)] text-[var(--aa-accent)]"
                            }`}
                          >
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-slate-600">
                          {item.unit_of_measure || "—"}
                        </td>
                        <td className="px-4 py-3 align-middle text-right font-medium text-[var(--aa-navy)]">
                          {item.selling_price != null &&
                          item.selling_price !== ""
                            ? formatNumber1(Number(item.selling_price))
                            : "—"}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                toggleProductStatus(item.id, item.status)
                              }
                              title="Click to toggle status"
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                                item.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {item.status || "Active"}
                            </button>
                            <WarehouseStatusBadge
                              item={item}
                              branches={branches}
                              onToggleStop={setWarehouseStopped}
                              togglingKey={togglingStopKey}
                              onEditTargets={() => openSalesTargetModal(item)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <Select
                            value={taxableValue}
                            onValueChange={(value) =>
                              updateTaxableStatus(item.id, value)
                            }
                          >
                            <SelectTrigger
                              className={`h-7 w-[130px] rounded-full border-0 px-2.5 text-xs font-semibold shadow-none ${taxStyle.badgeClass}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TAXABLE_STATUS_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className={opt.itemClass}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <span
                                      className={`h-2 w-2 shrink-0 rounded-full ${opt.dotClass}`}
                                    />
                                    {opt.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {renderRowActions(item)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {filteredData.length === 0
                    ? 0
                    : (pageFromUrl - 1) * pageSizeFromUrl + 1}
                  –
                  {Math.min(pageFromUrl * pageSizeFromUrl, filteredData.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredData.length}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Rows</span>
                  <Select
                    value={String(pageSizeFromUrl)}
                    onValueChange={(v) => handlePageSizeChange(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-[72px] border-slate-200 bg-white text-xs shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl <= 1}
                    onClick={() => handlePageChange(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl <= 1}
                    onClick={() => handlePageChange(pageFromUrl - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[4.5rem] text-center text-xs text-slate-600">
                    {pageFromUrl} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl >= totalPages}
                    onClick={() => handlePageChange(pageFromUrl + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 border-[var(--aa-navy)]/20 p-0 text-[var(--aa-navy)] shadow-none hover:bg-[var(--aa-sidebar-active)]"
                    disabled={pageFromUrl >= totalPages}
                    onClick={() => handlePageChange(totalPages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Stop Sales Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-600" />
              <span>Stop Sales</span>
            </div>
          }
          open={stopSalesModal.open}
          onCancel={() => setStopSalesModal(EMPTY_STOP_SALES_MODAL)}
          onOk={saveStopSales}
          okText="Save"
          cancelText="Cancel"
          confirmLoading={savingStopSales}
          centered
          width={520}
          destroyOnClose
        >
          <p className="mb-5 text-sm leading-relaxed text-gray-600">
            Stop selling <strong>{stopSalesModal.productName}</strong> at
            selected warehouses. Tick one or more stores — invoices at those
            locations will be blocked even if stock remains. Leave all unchecked
            to resume sales everywhere.
          </p>
          {stopSalesModal.legacyStopped ? (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This product currently has sales stopped everywhere. Saving will
              apply the stop only to the warehouses you tick.
            </p>
          ) : null}
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Warehouse
          </label>
          <div className="mb-2 max-h-52 overflow-y-auto rounded-md border border-slate-200">
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[var(--aa-accent)]"
                checked={
                  branches.length > 0 &&
                  branches.every((b) =>
                    (stopSalesModal.branchIds || []).includes(String(b.id)),
                  )
                }
                onChange={toggleAllStopSalesWarehouses}
              />
              Select all warehouses
            </label>
            {branches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">
                No warehouses found
              </p>
            ) : (
              branches.map((b) => {
                const id = String(b.id);
                const checked = (stopSalesModal.branchIds || []).includes(id);
                const existing = (stopSalesModal.sales_stops || []).find(
                  (s) => String(s.branch_id) === id,
                );
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2.5 border-b border-slate-50 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[var(--aa-accent)]"
                      checked={checked}
                      onChange={() => toggleStopSalesWarehouse(id)}
                    />
                    <span className="flex-1 text-slate-800">
                      {b.branch_name || `Warehouse ${b.id}`}
                    </span>
                    {existing ? (
                      <span className="text-[11px] text-red-700">Stopped</span>
                    ) : null}
                  </label>
                );
              })
            )}
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              <span>Delete Product</span>
            </div>
          }
          open={deleteModal.open}
          onCancel={() =>
            setDeleteModal({ open: false, productId: null, productName: "" })
          }
          onOk={confirmDeleteProduct}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{
            danger: true,
            loading: deleting,
          }}
          centered
        >
          <p className="text-gray-700">
            Are you sure you want to delete{" "}
            <strong>"{deleteModal.productName}"</strong>?
          </p>
          <p className="text-sm text-gray-500 mt-1">
            This action cannot be undone. Products with existing stock cannot be
            deleted.
          </p>
        </Modal>

        {/* Set Price Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span>Set Price</span>
            </div>
          }
          open={priceModal.open}
          onCancel={() =>
            setPriceModal({
              open: false,
              productId: null,
              productName: "",
              sellingPrice: "",
            })
          }
          onOk={saveProductPrice}
          okText="Save Price"
          cancelText="Cancel"
          confirmLoading={savingPrice}
          centered
        >
          <p className="text-gray-600 mb-4">
            Set selling price for <strong>{priceModal.productName}</strong>
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selling Price (₦)
          </label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={priceModal.sellingPrice}
            onChange={(e) =>
              setPriceModal((prev) => ({
                ...prev,
                sellingPrice: e.target.value,
              }))
            }
            placeholder="Enter selling price"
            size="large"
            prefix="₦"
          />
        </Modal>

        {/* Set Sales Target Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[var(--aa-accent)]" />
              <span>Set Sales Target</span>
            </div>
          }
          open={salesTargetModal.open}
          onCancel={() => setSalesTargetModal(EMPTY_SALES_TARGET_MODAL)}
          onOk={saveSalesTarget}
          okText="Save Target"
          cancelText="Cancel"
          confirmLoading={savingSalesTarget}
          centered
          width={640}
          destroyOnClose
        >
          <p className="mb-5 text-sm leading-relaxed text-gray-600">
            Limit how many units of{" "}
            <strong>{salesTargetModal.productName}</strong> can be sold per
            period. Set daily 30 for all stores, then change any warehouse’s
            period or quantity.
          </p>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Period for all selected stores
          </label>
          <AntSelect
            className="mb-4 w-full"
            size="large"
            value={salesTargetModal.period}
            onChange={(value) => applySalesTargetToAll({ period: value })}
            options={[
              { value: "none", label: "No limit (unlimited)" },
              ...SALES_TARGET_PERIOD_OPTIONS,
            ]}
            getPopupContainer={(node) => node?.parentElement || document.body}
          />
          {salesTargetModal.period !== "none" ? (
            <>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Quantity for all selected stores
              </label>
              <Input
                type="number"
                min={1}
                step="1"
                className="mb-4"
                size="large"
                value={salesTargetModal.quantity}
                onChange={(e) =>
                  applySalesTargetToAll({ quantity: e.target.value })
                }
                placeholder="e.g. 30"
              />
            </>
          ) : null}
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Warehouse {salesTargetModal.period !== "none" ? (
              <span className="text-red-500">*</span>
            ) : null}
          </label>
          <div className="mb-2 max-h-64 overflow-y-auto rounded-md border border-slate-200">
            <label className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-[var(--aa-accent)]"
                checked={
                  branches.length > 0 &&
                  branches.every((b) =>
                    (salesTargetModal.branchIds || []).includes(String(b.id)),
                  )
                }
                onChange={toggleAllSalesTargetWarehouses}
              />
              Select all warehouses
            </label>
            {branches.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">
                No warehouses found
              </p>
            ) : (
              branches.map((b) => {
                const id = String(b.id);
                const checked = (salesTargetModal.branchIds || []).includes(id);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2.5 border-b border-slate-50 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-[var(--aa-accent)]"
                      checked={checked}
                      onChange={() => toggleSalesTargetWarehouse(id)}
                    />
                    <span className="flex-1 text-slate-800">
                      {b.branch_name || `Warehouse ${b.id}`}
                    </span>
                    {salesTargetModal.period !== "none" ? (
                      <>
                        <select
                          disabled={!checked}
                          value={
                            checked
                              ? salesTargetModal.periods?.[id] ||
                                salesTargetModal.period ||
                                "daily"
                              : ""
                          }
                          onChange={(e) =>
                            setSalesTargetPeriod(id, e.target.value)
                          }
                          className="h-8 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          {SALES_TARGET_PERIOD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          step="1"
                          disabled={!checked}
                          value={
                            checked
                              ? salesTargetModal.quantities?.[id] ?? ""
                              : ""
                          }
                          onChange={(e) =>
                            setSalesTargetQuantity(id, e.target.value)
                          }
                          placeholder="Qty"
                          className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-sm disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          {salesTargetModal.period !== "none" ? (
            <p className="mt-2 text-xs text-slate-500">
              Type daily 30 above to fill every selected store, then change any
              store’s period or quantity. Unchecked stores have no limit.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Saving with no limit removes sales targets for this product at
              every warehouse.
            </p>
          )}
        </Modal>

        {/* Product Images Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-blue-600" />
              <span>Product Images</span>
            </div>
          }
          open={imagesModal.open}
          onCancel={() =>
            setImagesModal({
              open: false,
              productId: null,
              productName: "",
              images: [],
            })
          }
          onOk={saveProductImages}
          okText="Save Images"
          cancelText="Cancel"
          confirmLoading={savingImages}
          centered
          width={640}
        >
          <p className="text-gray-600 mb-4">
            Manage images for <strong>{imagesModal.productName}</strong>. The
            first image is used as the primary product image.
          </p>

          <div className="mb-4">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddProductImages}
              className="hidden"
              id="product-list-images-upload"
            />
            <label
              htmlFor="product-list-images-upload"
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Add Images
            </label>
            <p className="text-xs text-gray-500 mt-2">
              PNG, JPG, or GIF. Max 5MB per image. You can select multiple
              files.
            </p>
          </div>

          {imagesModal.images.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p>No images yet. Upload one or more product images.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-72 overflow-y-auto">
              {imagesModal.images.map((src, index) => (
                <div key={`${index}-${src.slice(0, 24)}`} className="relative">
                  <img
                    src={resolveProductImageUrl(src)}
                    alt={`Product ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border bg-gray-50"
                  />
                  {index === 0 && (
                    <span className="absolute top-1 left-1 bg-[var(--aa-navy)] text-white text-[10px] px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeProductImage(index)}
                    className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-700"
                    title="Delete image"
                    aria-label={`Delete image ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>

        {/* Product Description Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <span>Product Description</span>
            </div>
          }
          open={descriptionModal.open}
          onCancel={() =>
            setDescriptionModal({
              open: false,
              productId: null,
              productName: "",
              description: "",
            })
          }
          onOk={saveProductDescription}
          okText="Save Description"
          cancelText="Cancel"
          confirmLoading={savingDescription}
          centered
          width={560}
        >
          <p className="text-gray-600 mb-4">
            Add a description for{" "}
            <strong>{descriptionModal.productName}</strong>. Shown when the item
            is Online for customers.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <Input.TextArea
            rows={6}
            value={descriptionModal.description}
            onChange={(e) =>
              setDescriptionModal((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            placeholder="Describe this item for Online customers..."
            maxLength={2000}
            showCount
          />
        </Modal>

        {/* Create Group Modal */}
        <Modal
          title="Create Product Group"
          open={groupModalOpen}
          onOk={createProductGroup}
          onCancel={() => {
            setGroupModalOpen(false);
            setGroupName("");
          }}
          okText="Create Group"
          cancelText="Cancel"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Group Name
            </label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full"
            />
          </div>
          <div className="text-sm text-gray-600 mb-2">
            Selected products: {selectedProducts.length}
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full divide-y divide-gray-200 border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    SKU
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {data
                  .filter((item) => selectedProducts.includes(item.id))
                  .map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-center">{idx + 1}</td>
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.sku}</td>
                      <td className="px-3 py-2">{item.category}</td>
                      <td className="px-3 py-2">{item.item_type}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Modal>
      </div>
      </div>
    </div>
  );
}
