import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Eye, Search, Package, AlertTriangle,
  MoreHorizontal, ChevronDown, ChevronRight, History, X,
} from "lucide-react";
import { formatNumber1 } from "@/components/router/utilities";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { toast } from "sonner";
import moment from "moment";
import CustomTable1 from "@/common/Custom/CustomTable1";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

/** Goods = stocked sellable items (Resalable / Finished Good / By-Product) */
const isInventoryListItem = (item) =>
  ["Resalable", "Finished Good", "By-Product"].includes(item?.item_type);

export default function InventoryList() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  // ── Inventory list ────────────────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filteredItems, setFilteredItems] = useState([]);
  const [lowStockOpen, setLowStockOpen] = useState(false);
  const [expiredOpen, setExpiredOpen] = useState(false);
  const [showForm,setShowForm] = useState(false)

  const [showExpiry, setShowExpiry] = useState(false);
  const [writeOffItem, setWriteOffItem]               = useState(null);
  const [writeOffOpen, setWriteOffOpen]               = useState(false);
  const [writeOffQty, setWriteOffQty]                 = useState("");
  const [writeOffNotes, setWriteOffNotes]             = useState("");
  const [writeOffLoading, setWriteOffLoading]         = useState(false);

  // ── Account typeahead ─────────────────────────────────────────────────────
  const [accounts, setAccounts]                           = useState([]);
  const [accountsLoading, setAccountsLoading]             = useState(false);
  const [accountSearch, setAccountSearch]                 = useState("");
  const [accountOpen, setAccountOpen]                     = useState(false);
  const [selectedAccountOption, setSelectedAccountOption] = useState(null);

  // ── Write-off history ─────────────────────────────────────────────────────
  const [writeOffHistory, setWriteOffHistory]   = useState([]);
  const [historyLoading, setHistoryLoading]     = useState(false);
  const [historyOpen, setHistoryOpen]           = useState(false);
  const [historySearch, setHistorySearch]       = useState("");

  // ── Derived ───────────────────────────────────────────────────────────────
  const lowStockItems = useMemo(() => {
    return (inventoryItems || []).filter((item) => {
      const qty     = parseFloat(item.qty) || 0;
      const reorder = parseFloat(item.reorder_level) || 0;
      return reorder > 0 ? qty <= reorder : qty < 5;
    });
  }, [inventoryItems]);

  const expiredItems = useMemo(() => {
    const today = moment().startOf("day");
    return (inventoryItems || []).filter((item) => {
      if (!item.expiry_date) return false;
      return moment(item.expiry_date).isBefore(today);
    });
  }, [inventoryItems]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchInventory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    let url = `/inventory/inventory-list-all?facilityId=${activeBusiness.id}`;
    _fetchApi(
      url,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setInventoryItems(
            (resp.results || []).filter(isInventoryListItem),
          );
        } else {
          toast.error("Failed to load inventory data.");
          setInventoryItems([]);
        }
      },
      (err) => {
        setLoading(false);
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching data.");
        setInventoryItems([]);
      },
    );
  }, [activeBusiness?.id]);

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

  useEffect(() => { fetchInventory(); },   [fetchInventory]);
  useEffect(() => { fetchAccounts(); },    [fetchAccounts]);

  const openWriteOffHistory = () => {
    setHistorySearch("");
    setTimeout(() => {
      setHistoryOpen(true);
      fetchWriteOffHistory();
    }, 0);
  };

  // ── Filter inventory ──────────────────────────────────────────────────────
  useEffect(() => {
    let filtered = Array.isArray(inventoryItems) ? inventoryItems : [];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.product_id?.toLowerCase().includes(q) ||
          item.item_type?.toLowerCase().includes(q) ||
          item.status?.toLowerCase().includes(q),
      );
    }
    setFilteredItems(filtered);
  }, [inventoryItems, searchTerm]);

  // ── Write-off handlers ────────────────────────────────────────────────────
  const openWriteOff = (item) => {
    setWriteOffItem(item);
    setWriteOffQty(String(item.qty || ""));
    setWriteOffNotes("");
    setSelectedAccountOption(null);
    setAccountSearch("");
    setTimeout(() => setWriteOffOpen(true), 0);
  };

  const handleWriteOffSubmit = () => {
    if (!writeOffItem || !selectedAccountOption) {
      toast.error("Please select a Chart of Account Head");
      return;
    }
    const qty = Number(writeOffQty);
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    if (qty > Number(writeOffItem.qty || 0)) {
      toast.error(`Quantity exceeds available stock (${writeOffItem.qty})`);
      return;
    }
    setWriteOffLoading(true);
    _postApi(
      "/inventory/write-off",
      {
        facilityId:        activeBusiness.id,
        product_id:        writeOffItem.product_id,
        branch_name:       writeOffItem.branch_name,
        quantity:          qty,
        notes:             writeOffNotes,
        account_head_code: selectedAccountOption.head,
        account_head_name: selectedAccountOption.description,
        inserted_by:       activeBusiness?.user_name || "",
      },
      (resp) => {
        setWriteOffLoading(false);
        if (resp?.success) {
          toast.success(`Write-off completed. Ref: ${resp.data?.reference}`);
          setWriteOffOpen(false);
          fetchInventory();
          // Refresh history if the panel is open
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

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    {
      value: "name",
      title: "Item Details",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{item.name}</div>
          <div className="text-sm text-gray-500">SKU: {item.product_id}</div>
        </div>
      ),
    },
    {
      value: "item_type",
      title: "Item Type",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            {item.item_type || "Raw Material"}
          </span>
        </div>
      ),
    },
    {
      value: "status",
      title: "Status",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            item.status === "active" || item.status === "available"
              ? "bg-green-100 text-green-800"
              : item.status === "expired"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
          }`}>
            {item.status || "N/A"}
          </span>
        </div>
      ),
    },
    {
      value: "qty",
      title: "Available Stock",
      custom: true,
      className: "text-center",
      component: (item) => {
        const qty     = parseFloat(item.qty) || 0;
        const reorder = parseFloat(item.reorder_level) || 0;
        const isLow   = reorder > 0 ? qty <= reorder : qty < 5;
        return (
          <div className="text-center">
            <div className={`text-sm font-medium ${isLow ? "text-red-600" : "text-gray-900"}`}>
              {formatNumber1(qty)}
            </div>
            <div className="text-xs text-gray-500">{item.unit_of_measure || "units"}</div>
          </div>
        );
      },
    },
    ...(showExpiry ? [{
      value: "expiry_date",
      title: "Expiry Date",
      custom: true,
      className: "text-left",
      component: (item) => (
        <div className="text-sm text-gray-900">
          {item.expiry_date ? moment(item.expiry_date).format("MMM DD, YYYY") : "N/A"}
        </div>
      ),
    }] : []),
    {
      value: "action",
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => navigate(`/app/inventory/inventory-list/view/${item.product_id}?type=Purchase`)}
                className="cursor-pointer"
              >
                <Eye className="mr-2 h-4 w-4" />
                View Item
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setTimeout(() => openWriteOff(item), 0); }}
                className="text-red-600 focus:text-red-600 cursor-pointer"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Write-off (Scrap/Loss)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  // ── History columns ───────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryItems.length}</div>
            <p className="text-xs text-muted-foreground">Goods in stock</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${expiredItems.length > 0 ? "border-amber-200 hover:border-amber-400" : ""}`}
          onClick={() => expiredItems.length > 0 && setExpiredOpen((o) => !o)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${expiredItems.length > 0 ? "text-amber-700" : ""}`}>
              Expired Items
            </CardTitle>
            <div className="flex items-center gap-1">
              <Package className={`h-4 w-4 ${expiredItems.length > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              {expiredItems.length > 0 && (
                expiredOpen
                  ? <ChevronDown className="h-3 w-3 text-amber-500" />
                  : <ChevronRight className="h-3 w-3 text-amber-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${expiredItems.length > 0 ? "text-amber-600" : ""}`}>
              {expiredItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {expiredItems.length > 0 ? "Click to expand" : "No expired items"}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${lowStockItems.length > 0 ? "border-red-200 hover:border-red-400" : ""}`}
          onClick={() => lowStockItems.length > 0 && setLowStockOpen((o) => !o)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${lowStockItems.length > 0 ? "text-red-700" : ""}`}>
              Low Stock Alerts
            </CardTitle>
            <div className="flex items-center gap-1">
              <AlertTriangle className={`h-4 w-4 ${lowStockItems.length > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              {lowStockItems.length > 0 && (
                lowStockOpen
                  ? <ChevronDown className="h-3 w-3 text-red-500" />
                  : <ChevronRight className="h-3 w-3 text-red-500" />
               )}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? "text-red-600" : ""}`}>
              {lowStockItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {lowStockItems.length > 0 ? "Click to expand" : "All stock levels OK"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Low Stock Panel */}
      {lowStockOpen && lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-red-100 transition-colors"
            onClick={() => setLowStockOpen(false)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold text-red-700">
                Low Stock Items ({lowStockItems.length})
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-red-500" />
          </div>
          <div className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-red-200">
                    <th className="py-2 text-left font-semibold text-red-700">Item</th>
                    <th className="py-2 text-left font-semibold text-red-700">Item Type</th>
                    <th className="py-2 text-right font-semibold text-red-700">Qty on Hand</th>
                    <th className="py-2 text-right font-semibold text-red-700">Reorder Level</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems.map((item, i) => (
                    <tr key={i} className="border-b border-red-100 hover:bg-red-100/50">
                      <td className="py-1.5 text-gray-900 font-medium">{item.name}</td>
                      <td className="py-1.5 text-gray-600">{item.item_type || "Raw Material"}</td>
                      <td className="py-1.5 text-right font-bold text-red-600">
                        {formatNumber1(item.qty || 0)} {item.unit_of_measure || ""}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">
                        {item.reorder_level ? formatNumber1(item.reorder_level) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Collapsible Expired Items Panel */}
      {expiredOpen && expiredItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => setExpiredOpen(false)}
          >
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">
                Expired Items ({expiredItems.length})
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-amber-500" />
          </div>
          <div className="px-4 pb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-amber-200">
                    <th className="py-2 text-left font-semibold text-amber-700">Item</th>
                    <th className="py-2 text-left font-semibold text-amber-700">Item Type</th>
                    <th className="py-2 text-right font-semibold text-amber-700">Qty on Hand</th>
                    <th className="py-2 text-right font-semibold text-amber-700">Expired On</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredItems.map((item, i) => (
                    <tr key={i} className="border-b border-amber-100 hover:bg-amber-100/50">
                      <td className="py-1.5 text-gray-900 font-medium">{item.name}</td>
                      <td className="py-1.5 text-gray-600">{item.item_type || "Raw Material"}</td>
                      <td className="py-1.5 text-right font-bold text-amber-700">
                        {formatNumber1(item.qty || 0)} {item.unit_of_measure || ""}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">
                        {moment(item.expiry_date).format("DD MMM YYYY")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Goods List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, SKU, or status..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto flex-wrap">
              <Button
                variant={showExpiry ? "default" : "outline"}
                size="sm"
                onClick={() => setShowExpiry((v) => !v)}
                className="shrink-0"
              >
                {showExpiry ? "Hide Expiry" : "Show Expiry"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openWriteOffHistory}
                className="shrink-0"
              >
                <History className="mr-1 h-4 w-4" />
                Write-off History
              </Button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm
                  ? "No items match your filters."
                  : "There are currently no items in inventory."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <CustomTable1
                data={filteredItems}
                fields={columns}
                message="No inventory items found"
              />
            </div>
          )}
        </CardContent>
      </Card>

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
                <DialogTitle className="text-base">Write-off History</DialogTitle>
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
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm flex-1">
                <History className="mx-auto h-10 w-10 mb-2 opacity-30" />
                {writeOffHistory.length === 0 ? "No write-off records found." : "No records match your search."}
              </div>
            ) : (
              <div className="overflow-auto flex-1 min-h-0 border rounded-lg">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Reference</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Item</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">From</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Qty Written Off</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit Cost</th>
                      <th className="py-2 px-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Cost</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes</th>
                      <th className="py-2 px-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.map((row, i) => (
                      <tr key={row.id || i} className="hover:bg-orange-50/40 transition-colors">
                        <td className="py-2 px-3">
                          <span className="font-mono text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            {row.reference_number || "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-gray-600 text-xs whitespace-nowrap">
                          {row.created_at ? moment(row.created_at).format("DD MMM YYYY, HH:mm") : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900 text-xs">{row.product_name || "—"}</div>
                          <div className="text-gray-400 text-xs">{row.product_id}</div>
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
                  <tfoot className="sticky bottom-0 bg-gray-50">
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={6} className="py-2 px-3 text-xs font-semibold text-gray-700 text-right">
                        Total Written Off:
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900">
                        ₦{formatNumber1(filteredHistory.reduce((s, r) => s + Number(r.total_cost || 0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t shrink-0 flex justify-end">
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Write-off Modal */}
      <Dialog open={writeOffOpen} onOpenChange={(open) => { if (!open) setWriteOffOpen(false); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Write-off (Scrap/Loss)</DialogTitle>
          </DialogHeader>
          {writeOffItem && (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Item:</span>{" "}
                {writeOffItem.name} ({writeOffItem.product_id})
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-semibold">Available Stock:</span>{" "}
                {formatNumber1(Number(writeOffItem.qty || 0))} {writeOffItem.unit_of_measure || ""}
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
                <label className="text-sm font-medium">Chart of Account Head (Loss / Expense)</label>
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
                        onClick={() => { setSelectedAccountOption(null); setAccountSearch(""); }}
                        className="ml-1 text-gray-400 hover:text-red-500 font-bold shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        value={accountSearch}
                        onChange={(e) => { setAccountSearch(e.target.value); setAccountOpen(true); }}
                        onFocus={() => setAccountOpen(true)}
                        onBlur={() => setTimeout(() => setAccountOpen(false), 150)}
                        placeholder={accountsLoading ? "Loading accounts..." : "Type code or name to search..."}
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
                                String(acc.head || "").toLowerCase().includes(term) ||
                                String(acc.description || "").toLowerCase().includes(term)
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
                                <span className="font-mono text-xs text-gray-400 shrink-0 w-20">{acc.head}</span>
                                <span className="flex-1 text-gray-800">{acc.description}</span>
                                {acc.type && (
                                  <span className="text-xs text-gray-400 shrink-0">{acc.type}</span>
                                )}
                              </div>
                            ))}
                          {accounts.filter((acc) => {
                            if (!accountSearch) return true;
                            const term = accountSearch.toLowerCase();
                            return (
                              String(acc.head || "").toLowerCase().includes(term) ||
                              String(acc.description || "").toLowerCase().includes(term)
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
                <Button variant="outline" onClick={() => setWriteOffOpen(false)} disabled={writeOffLoading}>
                  Cancel
                </Button>
                <Button onClick={handleWriteOffSubmit} disabled={writeOffLoading}>
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
