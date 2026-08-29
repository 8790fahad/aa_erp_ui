import { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import Select from "react-select";
import {
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  History,
  AlertCircle,
  Package,
  AlertTriangle,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { getStoresList } from "@/redux/actions/stores";
import { toast } from "sonner";
import moment from "moment";
import { formatNumber1 } from "@/components/router/utilities";
import {
  canAccessPrivileges,
  getUserFunctionalities,
  hasFullAccess,
  isBusinessOwner,
} from "@/lib/access";

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: "Initiate Transfer",
    desc: "Request stock from the main branch to your branch",
  },
  {
    step: 2,
    title: "System Validates",
    desc: "Checks available stock at source location",
  },
  {
    step: 3,
    title: "Approval Workflow",
    desc: "Manager reviews and approves the transfer",
  },
  {
    step: 4,
    title: "Stock Updated",
    desc: "Both locations updated in real time instantly",
  },
];

/** Same shape as MakeSale lines view (`/account/get-ready-for-sales*`). */
const normalizeReadyForSalesItem = (item) => {
  const balance = parseFloat(item.balance ?? item.qty ?? 0) || 0;
  const productId = item.product_id || item.sku || item.item_code || "";
  return {
    ...item,
    id: item.id || productId,
    name: item.item_name || item.name || "",
    item_name: item.item_name || item.name || "",
    product_id: productId,
    item_code: item.sku || item.product_id || item.item_code || "",
    sku: item.sku || item.product_id || "",
    qty: balance,
    balance,
    branch_name: item.branch_name || "for sales",
    branch_id: item.branch_id ?? item.branchId ?? null,
    branchId: item.branchId ?? item.branch_id ?? null,
    unit_of_measure: item.unit_of_measure || item.uom || "Pcs",
    cost:
      parseFloat(item.cost ?? item.cost_price ?? item.selling_price ?? 0) || 0,
    selling_price: parseFloat(item.selling_price ?? 0) || 0,
  };
};

const newTransferNo = () =>
  `TRF-${moment().format("YYYY")}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;

const blankLine = () => ({
  id: Date.now() + Math.random(),
  productId: "",
  item: null,
  itemType: "",
  itemCode: "",
  uom: "",
  qty: "",
  amount: 0,
});

const GOODS_TRANSFER_TABS = [
  {
    value: "goods-list",
    label: "Goods",
    privilege: "Goods",
    aliases: ["Goods List"],
  },
  {
    value: "new",
    label: "New Goods Transfer",
    privilege: "New Goods Transfer",
  },
  {
    value: "history",
    label: "Transfer History",
    privilege: "Transfer History",
  },
  {
    value: "pending",
    label: "Pending Approvals",
    privilege: "Pending Approvals",
  },
];

const WRITE_OFF_PRIVILEGE = "Write-off (Scrap/Loss)";

const parseNumberFromFormatted = (value) => {
  if (!value || value === "") return "";
  return String(value).replace(/,/g, "");
};

const formatNumberWithCommas = (value) => {
  if (!value || value === "") return "";
  const numericValue = String(value).replace(/[^0-9.]/g, "");
  const endsWithDot = numericValue.endsWith(".");
  const parts = numericValue.split(".");
  const integerPart = parts[0] || "";
  const decimalPart = parts[1] || "";
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decimalPart) return `${formattedInteger}.${decimalPart}`;
  if (endsWithDot && integerPart) return `${formattedInteger}.`;
  return formattedInteger;
};

const sanitizeNumericInput = (value) => value.replace(/[^0-9.,]/g, "");

export default function GoodsTransfer() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeBusiness } = useSelector((state) => state.auth);

  const [branches, setBranches] = useState([]);

  const activeTab = searchParams.get("subtab") || "goods-list";
  const handleSubTabChange = (value) => {
    const next = new URLSearchParams(searchParams);
    // Always persist the tab — including "new". Clearing "new" used to fall
    // back to "goods-list", which left an empty panel when Goods List is hidden.
    if (value) next.set("subtab", value);
    else next.delete("subtab");
    setSearchParams(next, { replace: true });
  };

  // ----- New Transfer state -----
  const [transferNo, setTransferNo] = useState(newTransferNo);
  const [transferDate, setTransferDate] = useState(() =>
    moment().format("YYYY-MM-DD"),
  );
  const [storeFromId, setStoreFromId] = useState("");
  const [storeToId, setStoreToId] = useState("");
  const [stockItems, setStockItems] = useState([]);
  const [lineItems, setLineItems] = useState([blankLine()]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingStock, setLoadingStock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formStatus = "Draft";

  // ----- Pending & History (server-backed) -----
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [transferHistory, setTransferHistory] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  // Goods List tab — transferable stock by branch (FG, Resalable, By-Product).
  const [goodsListBranchId, setGoodsListBranchId] = useState("");
  const [goodsListItems, setGoodsListItems] = useState([]);
  const [goodsListSearch, setGoodsListSearch] = useState("");
  const [loadingGoodsList, setLoadingGoodsList] = useState(false);

  // Write-off (Scrap/Loss) from Goods tab
  const [writeOffItem, setWriteOffItem] = useState(null);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffQty, setWriteOffQty] = useState("");
  const [writeOffNotes, setWriteOffNotes] = useState("");
  const [writeOffLoading, setWriteOffLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [selectedAccountOption, setSelectedAccountOption] = useState(null);
  const [writeOffHistory, setWriteOffHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // Transfer History date range filter (defaults to the current month).
  const [historyFrom, setHistoryFrom] = useState(() =>
    moment().startOf("month").format("YYYY-MM-DD"),
  );
  const [historyTo, setHistoryTo] = useState(() =>
    moment().format("YYYY-MM-DD"),
  );
  const [historyToLocation, setHistoryToLocation] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [actioningId, setActioningId] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  // Per-item approved quantities for pending transfers:
  // { [transferId]: { [itemId]: "string value" } }
  const [approveQty, setApproveQty] = useState({});

  const functionalities = useMemo(
    () => getUserFunctionalities(user, activeBusiness),
    [user, activeBusiness],
  );

  const canViewTab = useCallback(
    (tabPrivilege) => {
      if (
        isBusinessOwner(user, activeBusiness) ||
        hasFullAccess(functionalities)
      ) {
        return true;
      }
      const tab = GOODS_TRANSFER_TABS.find((t) => t.privilege === tabPrivilege);
      const keys = [tabPrivilege, ...(tab?.aliases || [])];
      return canAccessPrivileges(keys, functionalities);
    },
    [activeBusiness, functionalities, user],
  );

  const canWriteOff = functionalities.includes(WRITE_OFF_PRIVILEGE);

  const visibleTabs = useMemo(
    () => GOODS_TRANSFER_TABS.filter((tab) => canViewTab(tab.privilege)),
    [canViewTab],
  );

  const hasAdminBranchAccess = useMemo(
    () =>
      String(user?.role || "")
        .toLowerCase()
        .includes("admin") || functionalities.includes("admin"),
    [user?.role, functionalities],
  );

  const branchById = (id) => branches.find((b) => b.id === parseInt(id, 10));
  const branchName = (id) => branchById(id)?.branch_name || "—";

  const isDefaultBranch = (b) =>
    b?.is_default === 1 || b?.is_default === true || b?.is_default === "1";

  // Main / default warehouse — stock is transferred FROM here.
  const mainBranchId = useMemo(() => {
    const main = branches.find(isDefaultBranch);
    if (main?.id != null) return parseInt(main.id, 10);
    const first = branches[0];
    return first?.id != null ? parseInt(first.id, 10) : null;
  }, [branches]);

  // The logged-in user's branch — the destination they are requesting stock for.
  const userBranchId = useMemo(() => {
    const candidate =
      user?.branchId ??
      (Array.isArray(user?.branchIds) ? user.branchIds[0] : null) ??
      (Array.isArray(user?.branches) ? user.branches[0]?.id : null);
    return candidate != null && candidate !== ""
      ? parseInt(candidate, 10)
      : null;
  }, [user?.branchId, user?.branchIds, user?.branches]);

  // Branch ids the user is assigned to (their own locations). Used to limit the
  // From Warehouse options AND to scope the Pending/History lists to the
  // branches the user has access to.
  const assignedBranchIds = useMemo(() => {
    const ids =
      Array.isArray(user?.branchIds) && user.branchIds.length
        ? user.branchIds
        : Array.isArray(user?.branches)
          ? user.branches.map((b) => b.id)
          : userBranchId != null
            ? [userBranchId]
            : [];
    return ids
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id));
  }, [user?.branchIds, user?.branches, userBranchId]);

  // Admins see every branch; other users are scoped to their assigned branches.
  const branchAccessQuery =
    !hasAdminBranchAccess && assignedBranchIds.length
      ? `&branchIds=${assignedBranchIds.join(",")}`
      : "";

  // ---------------------------------------------------------------------------
  // Fetchers
  // ---------------------------------------------------------------------------
  const fetchStock = useCallback(() => {
    if (!activeBusiness?.id || !storeFromId) {
      setStockItems([]);
      return;
    }
    setLoadingStock(true);

    const branchQuery = `&branchId=${encodeURIComponent(storeFromId)}`;
    const endpoint = `/inventory/goods-transfer/list?facilityId=${activeBusiness.id}${branchQuery}`;

    _fetchApi(
      endpoint,
      (resp) => {
        setLoadingStock(false);
        if (!resp?.success) {
          setStockItems([]);
          return;
        }
        const rows = (resp.results || resp.data || [])
          .map(normalizeReadyForSalesItem)
          .filter((item) => (parseFloat(item.qty ?? item.balance) || 0) > 0);
        setStockItems(rows);
      },
      () => {
        setLoadingStock(false);
        setStockItems([]);
        toast.error("Could not load inventory for the selected location");
      },
    );
  }, [activeBusiness?.id, storeFromId]);

  const fetchGoodsList = useCallback(() => {
    if (!activeBusiness?.id || !goodsListBranchId) {
      setGoodsListItems([]);
      return;
    }
    setLoadingGoodsList(true);
    const branchQuery = `&branchId=${encodeURIComponent(goodsListBranchId)}`;
    const endpoint = `/inventory/goods-transfer/list?facilityId=${activeBusiness.id}${branchQuery}`;
    _fetchApi(
      endpoint,
      (resp) => {
        setLoadingGoodsList(false);
        if (!resp?.success) {
          setGoodsListItems([]);
          return;
        }
        const rows = (resp.results || resp.data || [])
          .map(normalizeReadyForSalesItem)
          .filter((item) => (parseFloat(item.qty ?? item.balance) || 0) > 0);
        setGoodsListItems(rows);
      },
      () => {
        setLoadingGoodsList(false);
        setGoodsListItems([]);
        toast.error("Could not load goods list for the selected location");
      },
    );
  }, [activeBusiness?.id, goodsListBranchId]);

  const fetchAccounts = useCallback(() => {
    if (!activeBusiness?.id) return;
    setAccountsLoading(true);
    _fetchApi(
      `/account/account-categories?facilityId=${activeBusiness.id}`,
      (resp) => {
        setAccountsLoading(false);
        setAccounts(Array.isArray(resp?.flat) ? resp.flat : []);
      },
      () => setAccountsLoading(false),
    );
  }, [activeBusiness?.id]);

  const fetchWriteOffHistory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setHistoryLoading(true);
    _fetchApi(
      `/inventory/wip/action-history?facilityId=${activeBusiness.id}&actionType=write_off`,
      (resp) => {
        setHistoryLoading(false);
        setWriteOffHistory(resp?.data || []);
      },
      () => {
        setHistoryLoading(false);
        setWriteOffHistory([]);
      },
    );
  }, [activeBusiness?.id]);

  const openWriteOffHistory = () => {
    if (!canWriteOff) {
      toast.error("You do not have permission to view write-off history");
      return;
    }
    setHistorySearch("");
    setTimeout(() => {
      setHistoryOpen(true);
      fetchWriteOffHistory();
    }, 0);
  };

  const openWriteOff = (item) => {
    if (!canWriteOff) {
      toast.error("You do not have permission to write off stock");
      return;
    }
    setWriteOffItem(item);
    setWriteOffQty(String(item.qty ?? item.balance ?? ""));
    setWriteOffNotes("");
    setSelectedAccountOption(null);
    setAccountSearch("");
    if (!accounts.length) fetchAccounts();
    setTimeout(() => setWriteOffOpen(true), 0);
  };

  const handleWriteOffSubmit = () => {
    if (!canWriteOff) {
      toast.error("You do not have permission to write off stock");
      return;
    }
    if (!writeOffItem || !selectedAccountOption) {
      toast.error("Please select a Chart of Account Head");
      return;
    }
    const qty = Number(writeOffQty);
    const available = Number(writeOffItem.qty ?? writeOffItem.balance ?? 0);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (qty > available) {
      toast.error(`Quantity exceeds available stock (${available})`);
      return;
    }
    setWriteOffLoading(true);
    _postApi(
      "/inventory/write-off",
      {
        facilityId: activeBusiness.id,
        product_id: writeOffItem.product_id,
        branch_name: writeOffItem.branch_name || "for sales",
        branchId:
          writeOffItem.branch_id ??
          writeOffItem.branchId ??
          goodsListBranchId ??
          null,
        quantity: qty,
        notes: writeOffNotes,
        account_head_code: selectedAccountOption.head,
        account_head_name: selectedAccountOption.description,
        inserted_by: activeBusiness?.user_name || user?.name || "",
      },
      (resp) => {
        setWriteOffLoading(false);
        if (resp?.success) {
          toast.success(`Write-off completed. Ref: ${resp.data?.reference}`);
          setWriteOffOpen(false);
          fetchGoodsList();
          if (historyOpen) fetchWriteOffHistory();
        } else {
          toast.error(resp?.message || "Write-off failed");
        }
      },
      (err) => {
        setWriteOffLoading(false);
        toast.error(err?.message || "Write-off failed");
      },
    );
  };

  const filteredWriteOffHistory = useMemo(() => {
    if (!historySearch) return writeOffHistory;
    const q = historySearch.toLowerCase();
    return writeOffHistory.filter(
      (r) =>
        r.product_name?.toLowerCase().includes(q) ||
        r.product_id?.toLowerCase().includes(q) ||
        r.reference_number?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q),
    );
  }, [writeOffHistory, historySearch]);

  const fetchPending = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoadingPending(true);
    _fetchApi(
      `/inventory/goods-transfers?facilityId=${activeBusiness.id}&status=pending${branchAccessQuery}`,
      (resp) => {
        setLoadingPending(false);
        setPendingTransfers(resp?.success ? resp.results || [] : []);
      },
      () => {
        setLoadingPending(false);
        setPendingTransfers([]);
      },
    );
  }, [activeBusiness?.id, branchAccessQuery]);

  const fetchHistory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoadingHistory(true);
    const dateQuery =
      (historyFrom ? `&from=${historyFrom}` : "") +
      (historyTo ? `&to=${historyTo}` : "");
    const locationQuery = historyToLocation
      ? `&destinationBranchId=${encodeURIComponent(historyToLocation)}`
      : "";
    const statusParam =
      historyStatus && historyStatus !== "all"
        ? historyStatus
        : "pending,approved,rejected,cancelled";
    _fetchApi(
      `/inventory/goods-transfers?facilityId=${activeBusiness.id}&status=${statusParam}${branchAccessQuery}${dateQuery}${locationQuery}`,
      (resp) => {
        setLoadingHistory(false);
        const rows = resp?.success ? resp.results || [] : [];
        const statusOrder = {
          pending: 0,
          approved: 1,
          rejected: 2,
          cancelled: 3,
        };
        const sorted = [...rows].sort((a, b) => {
          const sa = statusOrder[String(a.status || "").toLowerCase()] ?? 99;
          const sb = statusOrder[String(b.status || "").toLowerCase()] ?? 99;
          if (sa !== sb) return sa - sb;
          return (
            new Date(b.transfer_date || b.created_at || 0).getTime() -
            new Date(a.transfer_date || a.created_at || 0).getTime()
          );
        });
        setTransferHistory(sorted);
      },
      () => {
        setLoadingHistory(false);
        setTransferHistory([]);
      },
    );
  }, [
    activeBusiness?.id,
    branchAccessQuery,
    historyFrom,
    historyTo,
    historyToLocation,
    historyStatus,
  ]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------
  useEffect(() => {
    dispatch(getStoresList());
  }, [dispatch]);

  useEffect(() => {
    if (!activeBusiness?.id) return;
    _fetchApi(
      `/account/get/branches?facilityId=${activeBusiness.id}`,
      (res) => {
        if (res?.success) setBranches(res.results || []);
      },
      (err) => console.error("Error fetching warehouses:", err),
    );
  }, [activeBusiness?.id]);

  // Locations are chosen manually: From first, then To appears.
  // Do not auto-fill either field on load.

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  useEffect(() => {
    if (!branches.length || goodsListBranchId) return;
    if (mainBranchId != null) setGoodsListBranchId(String(mainBranchId));
  }, [branches, mainBranchId, goodsListBranchId]);

  // Refetch pending/history/goods list when their tab is opened
  useEffect(() => {
    if (activeTab === "pending") fetchPending();
    if (activeTab === "history") fetchHistory();
    if (activeTab === "goods-list") fetchGoodsList();
  }, [activeTab, fetchPending, fetchHistory, fetchGoodsList]);

  // Initialise approve-qty inputs (default = min(requested, available)).
  useEffect(() => {
    setApproveQty((prev) => {
      const next = { ...prev };
      pendingTransfers.forEach((t) => {
        const existing = next[t.id] || {};
        const map = { ...existing };
        (t.items || []).forEach((it) => {
          const key = String(it.id);
          if (map[key] === undefined) {
            const requested = parseFloat(it.quantity) || 0;
            const available =
              it.available_qty != null
                ? parseFloat(it.available_qty) || 0
                : requested;
            map[key] = String(Math.max(0, Math.min(requested, available)));
          }
        });
        next[t.id] = map;
      });
      return next;
    });
  }, [pendingTransfers]);

  // Keep active tab within allowed privileges
  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((t) => t.value === activeTab)) {
      handleSubTabChange(visibleTabs[0].value);
    }
  }, [activeTab, visibleTabs]);

  // Stock availability is validated at approval time, so the request form only
  // requires a positive quantity.
  const getLineQtyError = useCallback((row) => {
    if (!row.item) return null;
    const qty = parseFloat(parseNumberFromFormatted(row.qty)) || 0;
    if (row.qty && qty <= 0) return "Enter a quantity greater than 0";
    return null;
  }, []);

  const lineQtyErrors = useMemo(
    () => lineItems.map((row) => getLineQtyError(row, lineItems)),
    [lineItems, getLineQtyError],
  );

  const hasInvalidQty = lineQtyErrors.some(Boolean);

  // Initial badge count for pending
  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const locationOptions = (branches || [])
    .filter((b) => b.branch_name)
    .map((b) => ({
      value: b.id,
      label: b.branch_name,
    }));

  // From Warehouse = all stores the current user can access.
  const fromLocationOptions = useMemo(() => {
    if (hasAdminBranchAccess) return locationOptions;
    if (assignedBranchIds.length) {
      const allowedIds = new Set([
        ...(mainBranchId != null ? [mainBranchId] : []),
        ...assignedBranchIds,
      ]);
      return locationOptions.filter((o) => allowedIds.has(o.value));
    }
    return locationOptions;
  }, [locationOptions, hasAdminBranchAccess, assignedBranchIds, mainBranchId]);

  const goodsListBranchOptions = useMemo(() => {
    if (hasAdminBranchAccess) return locationOptions;
    const allowedIds = new Set([
      ...(mainBranchId != null ? [mainBranchId] : []),
      ...assignedBranchIds,
    ]);
    return locationOptions.filter((o) => allowedIds.has(o.value));
  }, [locationOptions, hasAdminBranchAccess, mainBranchId, assignedBranchIds]);

  const filteredGoodsList = useMemo(() => {
    if (!goodsListSearch) return goodsListItems;
    const q = goodsListSearch.toLowerCase();
    return goodsListItems.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.item_name?.toLowerCase().includes(q) ||
        item.product_id?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q) ||
        item.item_type?.toLowerCase().includes(q),
    );
  }, [goodsListItems, goodsListSearch]);

  // To Warehouse = the requesting user's own branch(es).
  const toLocationOptions = useMemo(() => {
    const fromId = parseInt(storeFromId, 10);
    const base = assignedBranchIds.length
      ? locationOptions.filter((o) => assignedBranchIds.includes(o.value))
      : locationOptions;
    return base.filter((o) => o.value !== fromId);
  }, [locationOptions, assignedBranchIds, storeFromId]);

  // History filter: only destinations the current user can access.
  const historyToLocationOptions = useMemo(() => {
    if (hasAdminBranchAccess) return locationOptions;
    if (assignedBranchIds.length) {
      return locationOptions.filter((o) => assignedBranchIds.includes(o.value));
    }
    return locationOptions;
  }, [locationOptions, hasAdminBranchAccess, assignedBranchIds]);

  const productOptionLabel = (product) => {
    const name = product.item_name || product.name || "N/A";
    const code =
      product.sku || product.item_code || product.product_id || "N/A";
    const uom = product.unit_of_measure || product.uom || "Pcs";
    const avail = parseFloat(product.qty ?? product.balance) || 0;
    return `${name} (${code}) — ${formatNumber1(avail)} ${uom} available`;
  };

  const filteredStock = stockItems.filter(
    (item) =>
      !searchTerm ||
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.branch_name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const addLine = () => setLineItems((prev) => [...prev, blankLine()]);

  const clearAllLines = () => setLineItems([blankLine()]);

  const updateLine = (id, updates) => {
    setLineItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...updates };
        if (updates.item !== undefined) {
          next.item = updates.item;
          next.productId = updates.item?.product_id || updates.item?.sku || "";
          next.itemCode = updates.item?.sku || updates.item?.product_id || "";
          next.uom =
            updates.item?.unit_of_measure || updates.item?.uom || "Pcs";
          next.itemType = updates.item?.item_type || "";
        }
        if (updates.qty !== undefined) {
          const withoutCommas = String(updates.qty || "").replace(/,/g, "");
          const sanitizedValue = sanitizeNumericInput(withoutCommas);
          const parts = sanitizedValue.split(".");
          const numericValue =
            parts.length > 2
              ? parts[0] + "." + parts.slice(1).join("")
              : sanitizedValue;
          const qtyNum = parseFloat(numericValue) || 0;
          next.qty =
            numericValue === "" || qtyNum === 0
              ? formatNumberWithCommas(numericValue)
              : formatNumberWithCommas(String(qtyNum));
        }
        const item = next.item || row.item;
        const qtyNum =
          parseFloat(parseNumberFromFormatted(next.qty || row.qty)) || 0;
        const rate = item
          ? parseFloat(item.cost) || parseFloat(item.selling_price) || 0
          : 0;
        next.amount = qtyNum * rate;
        return next;
      }),
    );
  };

  const removeLine = (id) =>
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((r) => r.id !== id) : prev,
    );

  // ---------------------------------------------------------------------------
  // Submit / approve / reject
  // ---------------------------------------------------------------------------
  const buildPayloadItems = () => {
    const valid = lineItems.filter(
      (r) => r.item && parseFloat(parseNumberFromFormatted(r.qty)) > 0,
    );
    if (valid.length === 0) return null;

    return valid.map((r) => ({
      product_id: r.item.product_id,
      item_name: r.item.name || r.item.item_name,
      quantity: parseFloat(parseNumberFromFormatted(r.qty)),
      unit_of_measure: r.item.unit_of_measure || "Pcs",
      selling_price: r.item.selling_price || 0,
      mark_up: r.item.mark_up || 0.1,
      expiry_date:
        r.item.expiry_date && r.item.expiry_date !== "1111-11-11"
          ? r.item.expiry_date
          : null,
      supplier_code: r.item.supplier_code || r.item.product_id,
      supplier_name: r.item.supplierName || null,
      from_qty_snapshot: parseFloat(r.item.qty ?? r.item.balance ?? 0) || 0,
    }));
  };

  const submitTransfer = () => {
    if (!storeFromId || !storeToId) {
      toast.error("Select From and To locations");
      return;
    }
    if (parseInt(storeFromId, 10) === parseInt(storeToId, 10)) {
      toast.error("Source and destination cannot be the same");
      return;
    }
    const items = buildPayloadItems();
    if (!items) {
      if (
        lineItems.every(
          (r) => !r.item || !parseFloat(parseNumberFromFormatted(r.qty)),
        )
      ) {
        toast.error("Add at least one item with product and quantity");
      }
      return;
    }

    const initiatedByName = `${user?.fullname || `${user?.firstname || ""} ${user?.lastname || ""}`.trim() || user?.username || "User"}${user?.role ? ` (${user.role})` : ""}`;

    setSubmitting(true);
    _postApi(
      "/inventory/goods-transfers",
      {
        facilityId: activeBusiness.id,
        transfer_no: transferNo,
        transfer_date: transferDate,
        source_branch_id: parseInt(storeFromId, 10),
        destination_branch_id: parseInt(storeToId, 10),
        initiated_by: user?.id || null,
        initiated_by_name: initiatedByName,
        items,
      },
      (res) => {
        setSubmitting(false);
        if (res?.success) {
          const submittedNo = res?.transfer_no || transferNo;
          setSubmitSuccess({
            transferNo: submittedNo,
            message: `You have requested transfer ${submittedNo}. It is pending approval.`,
          });
          toast.success(`You have requested transfer ${submittedNo}`);
          setLineItems([blankLine()]);
          setTransferNo(newTransferNo());
          setSearchTerm("");
          setStoreFromId("");
          setStoreToId("");
          fetchPending();
        } else {
          toast.error(res?.message || "Transfer failed");
        }
      },
      (err) => {
        setSubmitting(false);
        toast.error(err?.message || "Transfer failed");
      },
    );
  };

  const setItemApproveQty = (transferId, itemId, value) => {
    // Allow only numbers / decimal point.
    const clean = String(value).replace(/[^0-9.]/g, "");
    setApproveQty((prev) => ({
      ...prev,
      [transferId]: { ...(prev[transferId] || {}), [String(itemId)]: clean },
    }));
  };

  const approveTransfer = (transfer) => {
    if (!transfer?.id) return;

    const qtyMap = approveQty[transfer.id] || {};
    const items = (transfer.items || []).map((it) => {
      const requested = parseFloat(it.quantity) || 0;
      const available =
        it.available_qty != null
          ? parseFloat(it.available_qty) || 0
          : requested;
      let qty = parseFloat(qtyMap[String(it.id)]);
      if (Number.isNaN(qty) || qty < 0) qty = 0;
      const cap = Math.min(requested, available);
      if (qty > cap) qty = cap;
      return { id: it.id, quantity: qty, requested, available, cap };
    });

    // Block approval when an entered qty exceeds what's available/requested.
    const invalid = items.find((it) => {
      const entered = parseFloat(qtyMap[String(it.id)]);
      return !Number.isNaN(entered) && entered > it.cap + 1e-6;
    });
    if (invalid) {
      toast.error(
        `Approve qty cannot exceed available stock (${formatNumber1(invalid.cap)})`,
      );
      return;
    }

    if (items.every((it) => it.quantity <= 0)) {
      toast.error(
        "Enter an approve quantity greater than 0 for at least one item",
      );
      return;
    }

    setActioningId(transfer.id);
    _postApi(
      `/inventory/goods-transfers/${transfer.id}/approve`,
      {
        facilityId: activeBusiness.id,
        approvedBy: user?.id || null,
        approvedByName: `${user?.fullname || `${user?.firstname || ""} ${user?.lastname || ""}`.trim() || user?.username || "User"}${user?.role ? ` (${user.role})` : ""}`,
        approval_date: moment().format("YYYY-MM-DD"),
        items: items.map((it) => ({ id: it.id, quantity: it.quantity })),
      },
      (res) => {
        setActioningId(null);
        if (res?.success) {
          toast.success(`Transfer ${transfer.transfer_no} approved`);
          fetchPending();
          fetchHistory();
        } else {
          toast.error(res?.message || "Approval failed");
        }
      },
      (err) => {
        setActioningId(null);
        toast.error(err?.message || "Approval failed");
      },
    );
  };

  const rejectTransfer = (transfer) => {
    if (!transfer?.id) return;
    if (!window.confirm(`Cancel transfer ${transfer.transfer_no}?`)) return;
    setActioningId(transfer.id);
    _postApi(
      `/inventory/goods-transfers/${transfer.id}/reject`,
      {
        facilityId: activeBusiness.id,
        rejectedBy: user?.id || null,
        rejection_reason: "Rejected via UI",
      },
      (res) => {
        setActioningId(null);
        if (res?.success) {
          toast.success(`Transfer ${transfer.transfer_no} cancelled`);
          fetchPending();
          fetchHistory();
        } else {
          toast.error(res?.message || "Rejection failed");
        }
      },
      (err) => {
        setActioningId(null);
        toast.error(err?.message || "Rejection failed");
      },
    );
  };

  const renderStatusBadge = (status) => {
    const map = {
      pending: "bg-amber-100 text-amber-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-slate-200 text-slate-700",
    };
    const cls = map[status] || "bg-slate-100 text-slate-700";
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${cls}`}>
        {status?.[0]?.toUpperCase() + status?.slice(1) || "—"}
      </span>
    );
  };

  const fieldClass =
    "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-navy)] focus:ring-2 focus:ring-[var(--aa-accent)]/20";
  const labelClass = "mb-1 block text-xs font-medium text-slate-600";
  const readonlyClass =
    "flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800";
  const sectionCardClass =
    "rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm";
  const tableHeadClass =
    "border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <div className="space-y-4">
      {submitSuccess && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="font-medium">{submitSuccess.message}</p>
            <p className="mt-1 text-emerald-700">
              View it under Pending Approvals or Transfer History.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {visibleTabs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-800">
          You do not have permission to access Goods on this account.
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={handleSubTabChange}
          className="w-full"
        >
          <TabsList className="mb-4 h-auto w-full justify-start gap-1 rounded-none border-b border-slate-200 bg-transparent p-0">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-[var(--aa-navy)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--aa-navy)] data-[state=active]:shadow-none"
              >
                {tab.value === "new" && <Plus className="h-3.5 w-3.5" />}
                {tab.value === "goods-list" && (
                  <Package className="h-3.5 w-3.5" />
                )}
                {tab.value === "history" && <History className="h-3.5 w-3.5" />}
                {tab.value === "pending" && <Clock className="h-3.5 w-3.5" />}
                {tab.label}
                {tab.value === "pending" && ` (${pendingTransfers.length})`}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ====== NEW TRANSFER ====== */}
          {canViewTab("New Goods Transfer") && (
            <TabsContent value="new" className="mt-0">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                  <div className={sectionCardClass}>
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className={labelClass}>Transfer No.</label>
                        <div className={readonlyClass}>{transferNo}</div>
                      </div>
                      <div>
                        <label className={labelClass}>Date</label>
                        <input
                          type="date"
                          value={transferDate}
                          onChange={(e) => setTransferDate(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>From Warehouse</label>
                        <select
                          value={storeFromId}
                          onChange={(e) => {
                            const nextFrom = e.target.value;
                            setStoreFromId(nextFrom);
                            setStoreToId("");
                            setSearchTerm("");
                            setLineItems([blankLine()]);
                          }}
                          className={fieldClass}
                        >
                          <option value="">Select location...</option>
                          {fromLocationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {storeFromId ? (
                        <div>
                          <label className={labelClass}>To Warehouse</label>
                          <select
                            value={storeToId}
                            onChange={(e) => setStoreToId(e.target.value)}
                            className={fieldClass}
                          >
                            <option value="">Select location...</option>
                            {toLocationOptions.map((b) => (
                              <option key={b.value} value={b.value}>
                                {b.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className={labelClass}>To Warehouse</label>
                          <div className="flex h-9 items-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                            Select From Warehouse first
                          </div>
                        </div>
                      )}
                      <div>
                        <label className={labelClass}>Initiated By</label>
                        <div className={readonlyClass}>
                          {`${user?.fullname || `${user?.firstname || ""} ${user?.lastname || ""}`.trim() || user?.username || "User"}${user?.role ? ` (${user.role})` : ""}`}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Status</label>
                        <div className={readonlyClass}>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {formStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-sm font-semibold text-slate-800">
                        Request Items
                        {storeFromId && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            Finished Good, Resalable &amp; By-Product
                          </span>
                        )}
                      </label>
                      {storeFromId && (
                        <input
                          type="text"
                          placeholder="Search items..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="h-8 w-60 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[var(--aa-navy)] focus:ring-2 focus:ring-[var(--aa-accent)]/20"
                        />
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={tableHeadClass}>
                            <th className="w-1/2 px-3 py-2.5 text-left">
                              Goods
                            </th>
                            <th className="px-3 py-2.5 text-left">UoM</th>
                            <th className="px-3 py-2.5 text-right">Qty</th>
                            <th className="px-3 py-2.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!storeFromId && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-3 py-8 text-center text-sm text-slate-500"
                              >
                                Pick a{" "}
                                <span className="font-semibold">
                                  From Warehouse
                                </span>{" "}
                                to load items.
                              </td>
                            </tr>
                          )}
                          {storeFromId && loadingStock && (
                            <tr>
                              <td
                                colSpan={4}
                                className="px-3 py-8 text-center text-sm text-slate-500"
                              >
                                Loading inventory…
                              </td>
                            </tr>
                          )}
                          {storeFromId &&
                            !loadingStock &&
                            filteredStock.length === 0 && (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-3 py-8 text-center text-sm text-slate-500"
                                >
                                  No Finished Good, Resalable, or By-Product
                                  stock at{" "}
                                  <span className="font-semibold">
                                    {branchName(storeFromId)}
                                  </span>
                                  .
                                </td>
                              </tr>
                            )}
                          {storeFromId &&
                            !loadingStock &&
                            filteredStock.length > 0 &&
                            lineItems.map((row, rowIndex) => {
                              const qtyError = lineQtyErrors[rowIndex];
                              return (
                                <tr
                                  key={row.id}
                                  className={`border-b border-slate-200 bg-white hover:bg-slate-50/50 ${qtyError ? "bg-red-50/40" : ""}`}
                                >
                                  <td className="px-3 py-2 min-w-[260px]">
                                    <Select
                                      id={`product-select-${row.id}`}
                                      options={filteredStock.map((product) => ({
                                        value: product,
                                        label: productOptionLabel(product),
                                      }))}
                                      placeholder={
                                        loadingStock
                                          ? "Loading products..."
                                          : "Select item..."
                                      }
                                      isClearable
                                      isLoading={loadingStock}
                                      isDisabled={!storeFromId || loadingStock}
                                      value={
                                        row.item
                                          ? {
                                              value: row.item,
                                              label: productOptionLabel(
                                                row.item,
                                              ),
                                            }
                                          : null
                                      }
                                      onChange={(selected) => {
                                        updateLine(row.id, {
                                          item: selected
                                            ? selected.value
                                            : null,
                                        });
                                        if (selected) {
                                          setTimeout(() => {
                                            const qtyInput =
                                              document.getElementById(
                                                `qty-input-${row.id}`,
                                              );
                                            if (qtyInput) qtyInput.focus();
                                          }, 0);
                                        }
                                      }}
                                      styles={{
                                        control: (provided, state) => ({
                                          ...provided,
                                          minHeight: "36px",
                                          borderColor: state.isFocused
                                            ? "var(--aa-navy)"
                                            : "#e2e8f0",
                                          borderWidth: "1px",
                                          borderRadius: "0.375rem",
                                          boxShadow: state.isFocused
                                            ? "0 0 0 3px rgb(66 103 178 / 0.15)"
                                            : "none",
                                          fontSize: "14px",
                                          "&:hover": {
                                            borderColor: state.isFocused
                                              ? "var(--aa-navy)"
                                              : "#cbd5e1",
                                          },
                                        }),
                                        menu: (provided) => ({
                                          ...provided,
                                          zIndex: 99999,
                                        }),
                                        menuPortal: (provided) => ({
                                          ...provided,
                                          zIndex: 99999,
                                        }),
                                      }}
                                      menuPortalTarget={document.body}
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="text"
                                      value={row.uom}
                                      readOnly
                                      className="w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-600 text-sm min-w-[60px]"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      id={`qty-input-${row.id}`}
                                      type="text"
                                      inputMode="decimal"
                                      value={row.qty}
                                      onChange={(e) =>
                                        updateLine(row.id, {
                                          qty: e.target.value,
                                        })
                                      }
                                      placeholder="-"
                                      disabled={!row.item}
                                      className={`w-full px-2 py-1.5 border rounded text-sm min-w-[70px] text-right ${
                                        qtyError
                                          ? "border-red-400 bg-red-50 text-red-900"
                                          : "border-slate-200 bg-white"
                                      } disabled:bg-slate-100 disabled:cursor-not-allowed`}
                                    />
                                    {qtyError && (
                                      <p className="mt-1 text-xs text-red-600 text-right">
                                        {qtyError}
                                      </p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeLine(row.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addLine}
                        disabled={!storeFromId}
                        className="border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add row
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearAllLines}
                        disabled={
                          lineItems.length === 1 &&
                          !lineItems[0]?.item &&
                          !lineItems[0]?.qty
                        }
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      {hasInvalidQty && (
                        <p className="mr-auto self-center text-sm text-red-600">
                          Enter a valid quantity for each item before
                          submitting.
                        </p>
                      )}
                      <Button
                        onClick={submitTransfer}
                        disabled={
                          submitting ||
                          !storeFromId ||
                          !storeToId ||
                          hasInvalidQty
                        }
                        className="border-0 bg-[var(--aa-navy)] text-white hover:bg-[var(--aa-navy)]/90"
                      >
                        {submitting ? "Submitting..." : "Submit Request"}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <div className="sticky top-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <AlertCircle className="h-4 w-4 text-[var(--aa-navy)]" />
                      How Goods Transfer Works
                    </h3>
                    <div className="space-y-4">
                      {WORKFLOW_STEPS.map((s) => (
                        <div key={s.step} className="flex gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--aa-sidebar-active)] text-[var(--aa-navy)] flex items-center justify-center text-sm font-bold">
                            {s.step}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">
                              {s.title}
                            </div>
                            <div className="text-sm text-slate-600">
                              {s.desc}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ====== GOODS LIST ====== */}
          {canViewTab("Goods") && (
            <TabsContent value="goods-list" className="mt-0">
              <div className={sectionCardClass}>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-slate-900">
                      Goods
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Finished Good, Resalable &amp; By-Product stock by
                      warehouse
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className={labelClass}>Warehouse</label>
                      <select
                        value={goodsListBranchId}
                        onChange={(e) => {
                          setGoodsListBranchId(e.target.value);
                          setGoodsListSearch("");
                        }}
                        className={`${fieldClass} min-w-[180px]`}
                      >
                        <option value="">Select warehouse...</option>
                        {goodsListBranchOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Search</label>
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={goodsListSearch}
                        onChange={(e) => setGoodsListSearch(e.target.value)}
                        disabled={!goodsListBranchId}
                        className={`${fieldClass} w-52 disabled:bg-slate-100`}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchGoodsList}
                      disabled={loadingGoodsList || !goodsListBranchId}
                    >
                      {loadingGoodsList ? "Refreshing…" : "Refresh"}
                    </Button>
                    {canWriteOff && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openWriteOffHistory}
                      >
                        <History className="mr-1 h-4 w-4" />
                        Write-off History
                      </Button>
                    )}
                  </div>
                </div>

                {!goodsListBranchId ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a warehouse to view available goods</p>
                  </div>
                ) : loadingGoodsList ? (
                  <div className="text-center py-12 text-slate-500">
                    Loading…
                  </div>
                ) : filteredGoodsList.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No transferable goods in stock at this warehouse</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={tableHeadClass}>
                          <th className="px-3 py-2.5 text-left">Goods</th>
                          <th className="px-3 py-2.5 text-left">SKU</th>
                          <th className="px-3 py-2.5 text-left">Item Type</th>
                          <th className="px-3 py-2.5 text-right">
                            Available Stock
                          </th>
                          <th className="px-3 py-2.5 text-left">UoM</th>
                          {canWriteOff && (
                            <th className="px-3 py-2.5 text-center">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredGoodsList.map((item) => (
                          <tr
                            key={`${item.product_id}-${item.sku || ""}-${item.branch_id || item.branchId || ""}`}
                            className="border-b border-slate-200 bg-white hover:bg-slate-50/50"
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {item.item_name || item.name || "—"}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {item.sku || item.product_id || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-800">
                                {item.item_type || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                title="View stock in / out history"
                                onClick={() => {
                                  const pid =
                                    item.product_id ||
                                    item.sku ||
                                    item.item_code;
                                  if (!pid) {
                                    toast.error(
                                      "Product id missing for this item",
                                    );
                                    return;
                                  }
                                  const params = new URLSearchParams({
                                    type: "all",
                                  });
                                  // Warehouse you came from (Goods list selection), not the product default.
                                  const sourceBranchId =
                                    goodsListBranchId ||
                                    item.branch_id ||
                                    item.branchId;
                                  if (sourceBranchId) {
                                    params.set(
                                      "branchId",
                                      String(sourceBranchId),
                                    );
                                  }
                                  navigate(
                                    `/app/inventory/inventory-list/view/${encodeURIComponent(pid)}?${params.toString()}`,
                                  );
                                }}
                                className="tabular-nums font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800"
                              >
                                {formatNumber1(
                                  parseFloat(item.qty ?? item.balance) || 0,
                                )}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {item.unit_of_measure || item.uom || "Pcs"}
                            </td>
                            {canWriteOff && (
                              <td className="px-3 py-2.5 text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        setTimeout(() => openWriteOff(item), 0);
                                      }}
                                      className="text-red-600 focus:text-red-600 cursor-pointer"
                                    >
                                      <AlertTriangle className="mr-2 h-4 w-4" />
                                      Write-off (Scrap/Loss)
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* ====== HISTORY ====== */}
          {canViewTab("Transfer History") && (
            <TabsContent value="history" className="mt-0">
              <div className={sectionCardClass}>
                <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
                  <h3 className="text-base font-semibold tracking-tight text-slate-900">
                    Transfer History
                  </h3>
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className={labelClass}>To Warehouse</label>
                      <select
                        value={historyToLocation}
                        onChange={(e) => setHistoryToLocation(e.target.value)}
                        className={`${fieldClass} min-w-[10rem]`}
                      >
                        <option value="">All my locations</option>
                        {historyToLocationOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Status</label>
                      <select
                        value={historyStatus}
                        onChange={(e) => setHistoryStatus(e.target.value)}
                        className={`${fieldClass} min-w-[9rem]`}
                      >
                        <option value="all">All status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Date From</label>
                      <input
                        type="date"
                        value={historyFrom}
                        max={historyTo || undefined}
                        onChange={(e) => setHistoryFrom(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Date To</label>
                      <input
                        type="date"
                        value={historyTo}
                        min={historyFrom || undefined}
                        onChange={(e) => setHistoryTo(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchHistory}
                      disabled={loadingHistory}
                    >
                      {loadingHistory ? "Refreshing…" : "Apply"}
                    </Button>
                  </div>
                </div>
                {loadingHistory ? (
                  <div className="text-center py-12 text-slate-500">
                    Loading…
                  </div>
                ) : transferHistory.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No transfer history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transferHistory.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-xl border border-slate-200 p-4 transition-colors hover:bg-slate-50/80"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div>
                            <div className="font-semibold">{t.transfer_no}</div>
                            <div className="text-sm text-slate-600">
                              {t.source_branch_name ||
                                branchName(t.source_branch_id)}{" "}
                              →{" "}
                              {t.destination_branch_name ||
                                branchName(t.destination_branch_id)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {moment(t.transfer_date).format("DD MMM YYYY")} •{" "}
                              {t.initiated_by_name || "Unknown"}
                              {t.approved_by_name
                                ? ` • approved by ${t.approved_by_name}`
                                : ""}
                            </div>
                          </div>
                          {renderStatusBadge(t.status)}
                        </div>
                        <table className="w-full mt-3 text-sm">
                          <thead>
                            <tr className="text-left text-slate-600">
                              <th>Goods</th>
                              <th>SKU</th>
                              <th className="text-right">Transfer Qty</th>
                              <th>UOM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(t.items || []).map((it) => (
                              <tr key={it.id ?? `${t.id}-${it.product_id}`}>
                                <td>{it.item_name || it.product_name}</td>
                                <td>{it.product_id}</td>
                                <td className="text-right">
                                  {formatNumber1(it.quantity)}
                                </td>
                                <td>
                                  {it.unit_of_measure ||
                                    it.product_uom ||
                                    "Pcs"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

          {/* ====== PENDING ====== */}
          {canViewTab("Pending Approvals") && (
            <TabsContent value="pending" className="mt-0">
              <div className={sectionCardClass}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold tracking-tight text-slate-900">
                    Pending Approvals
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchPending}
                    disabled={loadingPending}
                  >
                    {loadingPending ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>
                {loadingPending ? (
                  <div className="text-center py-12 text-slate-500">
                    Loading…
                  </div>
                ) : pendingTransfers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No pending transfers</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pendingTransfers.map((t) => (
                      <div
                        key={t.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-slate-50/80 border-b">
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              Transfer Date
                            </div>
                            <div className="font-medium text-slate-900">
                              {moment(t.transfer_date).format("DD MMMM YYYY")}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              Transfer No
                            </div>
                            <div className="font-medium text-slate-900">
                              {t.transfer_no}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              From Warehouse
                            </div>
                            <div className="font-medium text-slate-900">
                              {t.source_branch_name ||
                                branchName(t.source_branch_id)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              To Warehouse
                            </div>
                            <div className="font-medium text-slate-900">
                              {t.destination_branch_name ||
                                branchName(t.destination_branch_id)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              Initiated By
                            </div>
                            <div className="font-medium text-slate-900">
                              {t.initiated_by_name || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wide">
                              Status
                            </div>
                            {renderStatusBadge(t.status)}
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className={tableHeadClass}>
                                <th className="px-4 py-3 text-left font-medium">
                                  Goods
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  SKU
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                  Available Qty
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                  Transfer Qty
                                </th>
                                <th className="px-4 py-3 text-right font-medium">
                                  Approve Qty
                                </th>
                                <th className="px-4 py-3 text-left font-medium">
                                  UOM
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(t.items || []).map((it, idx) => {
                                const requested = parseFloat(it.quantity) || 0;
                                const available =
                                  it.available_qty != null
                                    ? parseFloat(it.available_qty) || 0
                                    : requested;
                                const cap = Math.min(requested, available);
                                const entered = parseFloat(
                                  (approveQty[t.id] || {})[String(it.id)],
                                );
                                const exceeds =
                                  !Number.isNaN(entered) &&
                                  entered > cap + 1e-6;
                                return (
                                  <tr
                                    key={it.id ?? idx}
                                    className={`border-b border-slate-100 ${
                                      exceeds
                                        ? "bg-red-100"
                                        : idx % 2 === 0
                                          ? "bg-white"
                                          : "bg-slate-50/50"
                                    }`}
                                  >
                                    <td className="px-4 py-3 font-medium text-slate-900">
                                      {it.item_name || it.product_name}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                      {it.product_id}
                                    </td>
                                    <td
                                      className={`px-4 py-3 text-right font-semibold ${
                                        available >= requested && available > 0
                                          ? "bg-green-100 text-green-700"
                                          : "bg-red-100 text-red-700"
                                      }`}
                                    >
                                      {formatNumber1(available)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {formatNumber1(requested)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={
                                          (approveQty[t.id] || {})[
                                            String(it.id)
                                          ] ?? ""
                                        }
                                        onChange={(e) =>
                                          setItemApproveQty(
                                            t.id,
                                            it.id,
                                            e.target.value,
                                          )
                                        }
                                        className={`w-24 rounded-md border px-2 py-1 text-right text-sm focus:outline-none focus:border-[var(--aa-navy)] focus:ring-2 focus:ring-[var(--aa-accent)]/20 ${
                                          exceeds
                                            ? "border-red-400 bg-red-50"
                                            : "border-slate-200"
                                        }`}
                                      />
                                      {exceeds && (
                                        <div className="mt-1 text-[11px] text-red-600">
                                          Max {formatNumber1(cap)}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {it.unit_of_measure ||
                                        it.product_uom ||
                                        "Pcs"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t bg-slate-50/50">
                          <Button
                            variant="outline"
                            onClick={() => rejectTransfer(t)}
                            disabled={actioningId === t.id}
                            className="border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => approveTransfer(t)}
                            disabled={actioningId === t.id}
                            className="border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {actioningId === t.id
                              ? "Approving…"
                              : "Approve Transfer"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Write-off History Modal */}
      <Dialog
        open={historyOpen}
        onOpenChange={(open) => {
          if (!open) {
            setHistoryOpen(false);
            setHistorySearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-orange-500" />
                <DialogTitle className="text-base">
                  Write-off History
                </DialogTitle>
                {writeOffHistory.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                    {writeOffHistory.length}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchWriteOffHistory}
                disabled={historyLoading}
                className="text-xs shrink-0"
              >
                {historyLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </DialogHeader>

          <div className="px-6 py-4 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by item name, SKU, reference, notes..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--aa-accent)] focus:border-transparent"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
              {historySearch && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setHistorySearch("")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-16 flex-1">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400" />
              </div>
            ) : filteredWriteOffHistory.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm flex-1">
                <History className="mx-auto h-10 w-10 mb-2 opacity-30" />
                {writeOffHistory.length === 0
                  ? "No write-off records found."
                  : "No records match your search."}
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0 border rounded-lg">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Reference
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Item
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        From
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Qty Written Off
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Unit Cost
                      </th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Total Cost
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Notes
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWriteOffHistory.map((row, i) => (
                      <tr
                        key={row.id || i}
                        className="hover:bg-orange-50/40 transition-colors"
                      >
                        <td className="py-2 px-3">
                          <span className="font-mono text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            {row.reference_number || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 text-xs whitespace-nowrap">
                          {row.created_at
                            ? moment(row.created_at).format(
                                "DD MMM YYYY, HH:mm",
                              )
                            : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900 text-xs">
                            {row.product_name || "—"}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {row.product_id}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {row.source_location || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-red-600">
                          {formatNumber1(Number(row.quantity || 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">
                          ₦{formatNumber1(Number(row.unit_cost || 0))}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900">
                          ₦{formatNumber1(Number(row.total_cost || 0))}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500 max-w-[160px] truncate">
                          {row.notes || "—"}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {row.created_by || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="px-6 py-3 border-t flex justify-end shrink-0">
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Write-off Modal */}
      <Dialog
        open={writeOffOpen}
        onOpenChange={(open) => {
          if (!open) setWriteOffOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Write-off (Scrap/Loss)</DialogTitle>
          </DialogHeader>
          {writeOffItem && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Item:</span>{" "}
                {writeOffItem.item_name || writeOffItem.name} (
                {writeOffItem.product_id})
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Available Stock:</span>{" "}
                {formatNumber1(
                  Number(writeOffItem.qty ?? writeOffItem.balance ?? 0),
                )}{" "}
                {writeOffItem.unit_of_measure || writeOffItem.uom || ""}
              </div>

              <div>
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={writeOffQty}
                  onChange={(e) => setWriteOffQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  type="text"
                  value={writeOffNotes}
                  onChange={(e) => setWriteOffNotes(e.target.value)}
                  placeholder="Reason / remark"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Chart of Account Head (Loss / Expense)
                </label>
                <div className="mt-1 relative">
                  {selectedAccountOption ? (
                    <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-500 shrink-0">
                        {selectedAccountOption.head}
                      </span>
                      <span className="flex-1 text-gray-800 truncate">
                        {selectedAccountOption.description}
                      </span>
                      {selectedAccountOption.type && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {selectedAccountOption.type}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAccountOption(null);
                          setAccountSearch("");
                        }}
                        className="ml-1 text-gray-400 hover:text-red-500 font-bold shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        value={accountSearch}
                        onChange={(e) => {
                          setAccountSearch(e.target.value);
                          setAccountOpen(true);
                        }}
                        onFocus={() => setAccountOpen(true)}
                        onBlur={() =>
                          setTimeout(() => setAccountOpen(false), 150)
                        }
                        placeholder={
                          accountsLoading
                            ? "Loading accounts..."
                            : "Type code or name to search..."
                        }
                        disabled={accountsLoading || writeOffLoading}
                        autoComplete="off"
                      />
                      {accountOpen && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow-lg max-h-56 overflow-y-auto">
                          {accounts
                            .filter((acc) => {
                              if (!accountSearch) return true;
                              const term = accountSearch.toLowerCase();
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
                                  setSelectedAccountOption(acc);
                                  setAccountSearch("");
                                  setAccountOpen(false);
                                }}
                                className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
                              >
                                <span className="font-mono text-xs text-gray-400 shrink-0 w-20">
                                  {acc.head}
                                </span>
                                <span className="flex-1 text-gray-800">
                                  {acc.description}
                                </span>
                                {acc.type && (
                                  <span className="text-xs text-gray-400 shrink-0">
                                    {acc.type}
                                  </span>
                                )}
                              </div>
                            ))}
                          {accounts.filter((acc) => {
                            if (!accountSearch) return true;
                            const term = accountSearch.toLowerCase();
                            return (
                              String(acc.head || "")
                                .toLowerCase()
                                .includes(term) ||
                              String(acc.description || "")
                                .toLowerCase()
                                .includes(term)
                            );
                          }).length === 0 && (
                            <div className="px-3 py-3 text-sm text-gray-400 italic text-center">
                              No accounts found
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setWriteOffOpen(false)}
                  disabled={writeOffLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleWriteOffSubmit}
                  disabled={writeOffLoading}
                >
                  {writeOffLoading ? "Processing..." : "Confirm"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
