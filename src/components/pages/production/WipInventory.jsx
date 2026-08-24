import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Package,
  Calendar,
  AlertCircle,
  MoreVertical,
  FlaskConical,
  History,
  ListOrdered,
} from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { formatNumber } from "@/utilities";
import { toast } from "sonner";
import CustomTable1 from "@/common/Custom/CustomTable1";
import DepartmentSelect from "@/components/common/DepartmentSelect";
import moment from "moment";
import MixtureModal from "./MixtureModal";
import MixtureHistory from "./MixtureHistory";

export default function WipInventory() {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [wipItems, setWipItems] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [summary, setSummary] = useState({
    totalWipItems: 0,
    totalWipValue: 0,
    activeProductionOrders: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [isMixtureModalOpen, setIsMixtureModalOpen] = useState(false);
  const [isMixtureHistoryOpen, setIsMixtureHistoryOpen] = useState(false);
  const [mixtureRefreshKey, setMixtureRefreshKey] = useState(0);
  const [isWipActionOpen, setIsWipActionOpen] = useState(false);
  const [wipActionType, setWipActionType] = useState("");
  const [wipActionItem, setWipActionItem] = useState(null);
  const [wipActionQty, setWipActionQty] = useState("");
  const [wipActionNotes, setWipActionNotes] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedAccountOption, setSelectedAccountOption] = useState(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [wipActionSubmitting, setWipActionSubmitting] = useState(false);
  const [isWipHistoryOpen, setIsWipHistoryOpen] = useState(false);
  const [wipActionHistory, setWipActionHistory] = useState([]);
  const [wipHistoryLoading, setWipHistoryLoading] = useState(false);

  const fetchWipInventory = useCallback(() => {
    if (!activeBusiness?.id) return;

    setLoading(true);
    _fetchApi(
      `/inventory/wip?facilityId=${activeBusiness.id}`,
      (resp) => {
        if (resp.success) {
          setWipItems(resp.data.wipItems || []);
          setProductionOrders(resp.data.productionOrders || []);
          setSummary(
            resp.data.summary || {
              totalWipItems: 0,
              totalWipValue: 0,
              activeProductionOrders: 0,
            },
          );
        } else {
          toast.error("Failed to load WIP inventory data");
        }
        setLoading(false);
      },
      (err) => {
        console.error("API Error:", err);
        toast.error("Something went wrong while fetching WIP inventory data");
        setLoading(false);
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchWipInventory();
  }, [fetchWipInventory]);

  const fetchAccounts = useCallback(() => {
    if (!activeBusiness?.id) return;
    setAccountsLoading(true);
    _fetchApi(
      `/account/account-categories?facilityId=${activeBusiness.id}`,
      (resp) => {
        setAccountsLoading(false);
        setAccounts(Array.isArray(resp?.flat) ? resp.flat : []);
      },
      () => {
        setAccountsLoading(false);
        setAccounts([]);
      },
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const filteredWipItems = wipItems.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.item_name?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      item.category?.toLowerCase().includes(term)
    );
  });

  const getStatusColor = (status) => {
    const primaryColor = activeBusiness?.primary_color || "#7c3aed";

    switch (status?.toLowerCase()) {
      case "in_progress":
        return `bg-[${primaryColor}]/10 text-[${primaryColor}]`;
      case "planned":
        return `bg-[${primaryColor}]/20 text-[${primaryColor}]`;
      case "started":
        return `bg-[${primaryColor}]/30 text-[${primaryColor}]`;
      default:
        return `bg-[${primaryColor}]/10 text-[${primaryColor}]`;
    }
  };

  const calculateProgress = (planned, actual) => {
    if (!planned || planned <= 0) return 0;
    return Math.min(100, Math.round((actual / planned) * 100));
  };

  const openWipActionDialog = (item, actionType) => {
    // setTimeout lets Radix DropdownMenu finish its close/focus cleanup
    // before React opens the Dialog — prevents the focus-trap conflict.
    setTimeout(() => {
      setWipActionItem(item);
      setWipActionType(actionType);
      setWipActionQty(String(item?.balance || ""));
      setWipActionNotes("");
      // Pre-select the business WIP account code by default
      const wipCode = activeBusiness?.wip;
      const wipAccount = wipCode
        ? accounts.find((acc) => String(acc.head || "").trim() === String(wipCode).trim())
        : null;
      setSelectedAccountOption(wipAccount || null);
      setAccountSearch("");
      setAccountOpen(false);
      setIsWipActionOpen(true);
    }, 0);
  };

  const closeWipActionDialog = () => {
    setIsWipActionOpen(false);
    setWipActionItem(null);
    setWipActionType("");
    setWipActionQty("");
    setWipActionNotes("");
    setSelectedAccountOption(null);
    setAccountSearch("");
    setAccountOpen(false);
    setWipActionSubmitting(false);
  };

  const submitWipAction = () => {
    if (!wipActionItem?.sku || !wipActionType) {
      toast.error("Please select an item action");
      return;
    }

    const qty = Number(wipActionQty);
    const available = Number(wipActionItem?.balance || 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid quantity greater than zero");
      return;
    }

    if (qty > available) {
      toast.error(`Quantity cannot exceed available WIP balance (${available})`);
      return;
    }

    if (!selectedAccountOption?.head) {
      toast.error("Please select a chart of account head");
      return;
    }

    setWipActionSubmitting(true);
    _postApi(
      "/inventory/wip/action",
      {
        product_id: wipActionItem.sku,
        action: wipActionType,
        quantity: qty,
        unit_cost: Number(wipActionItem.unit_cost || 0),
        notes: wipActionNotes,
        account_head_code: selectedAccountOption?.head || null,
        account_head_name: selectedAccountOption?.description || null,
      },
      (resp) => {
        setWipActionSubmitting(false);
        if (resp?.success) {
          toast.success(resp.message || "WIP action completed successfully");
          closeWipActionDialog();
          fetchWipInventory();
          fetchWipActionHistory();
          return;
        }
        toast.error(resp?.message || "Failed to complete WIP action");
      },
      (err) => {
        setWipActionSubmitting(false);
        console.error("WIP action failed:", err);
        toast.error("Failed to complete WIP action");
      },
    );
  };

  const fetchWipActionHistory = useCallback(() => {
    if (!activeBusiness?.id) return;
    setWipHistoryLoading(true);
    _fetchApi(
      `/inventory/wip/action-history?facilityId=${activeBusiness.id}`,
      (resp) => {
        setWipHistoryLoading(false);
        if (resp?.success) {
          setWipActionHistory(resp.data || []);
          return;
        }
        toast.error("Failed to load WIP action history");
      },
      () => {
        setWipHistoryLoading(false);
        toast.error("Failed to load WIP action history");
      },
    );
  }, [activeBusiness?.id]);

  const wipfields = [
    { title: "SKU", value: "sku" },
    { title: "Name", value: "name" },
    {
      title: "Category / UoM",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="text-center">
          {item.category}({item.unit_of_measure})
        </div>
      ),
    },
    {
      title: "Quantity Balance",
      className: "text-",
      custom: true,
      component: (item) => (
        <div className="text-center">{formatNumber(item.balance)}</div>
      ),
    },
    {
      title: "Action",
      custom: true,
      className: "text-center",
      component: (item) => (
        <div className="flex items-center justify-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Actions"
                aria-label="Row actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={() => openWipActionDialog(item, "return_raw_material")}
              >
                Return to Raw Material
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={() => openWipActionDialog(item, "write_off")}
              >
                Write-off (Scrap/Loss)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold"
          style={{ color: activeBusiness?.primary_color || "#7c3aed" }}
        >
          Work-In-Progress Inventory
        </h1>
        <p className="text-gray-600 mt-2">
          Track materials currently in production and active production orders
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">WIP Items</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {filteredWipItems.length}
                </h3>
              </div>
              <div
                className="p-3 rounded-full"
                style={{
                  backgroundColor: `${
                    activeBusiness?.primary_color || "#7c3aed"
                  }20`,
                  color: activeBusiness?.primary_color || "#7c3aed",
                }}
              >
                <Package className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total WIP Value
                </p>
                <h3 className="text-2xl font-bold text-gray-900">
                  ₦{formatNumber(summary.totalWipValue)}
                </h3>
              </div>
              <div
                className="p-3 rounded-full"
                style={{
                  backgroundColor: `${
                    activeBusiness?.primary_color || "#7c3aed"
                  }30`,
                  color: activeBusiness?.primary_color || "#7c3aed",
                }}
              >
                <AlertCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Orders
                </p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {summary.activeProductionOrders}
                </h3>
              </div>
              <div
                className="p-3 rounded-full"
                style={{
                  backgroundColor: `${
                    activeBusiness?.primary_color || "#7c3aed"
                  }40`,
                  color: activeBusiness?.primary_color || "#7c3aed",
                }}
              >
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by item name, SKU, or category..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              onClick={fetchWipInventory}
              disabled={loading}
              style={{
                backgroundColor: activeBusiness?.primary_color || "#7c3aed",
                color: activeBusiness?.secondary_color || "#ffffff",
              }}
            >
              {loading ? "Refreshing..." : "Refresh Data"}
            </Button>
            <Button
              onClick={() => setIsMixtureHistoryOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              Mixture History
            </Button>
            <Button
              onClick={() => {
                setIsWipHistoryOpen(true);
                fetchWipActionHistory();
              }}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ListOrdered className="h-4 w-4" />
              WIP Action History
            </Button>
            <Button
              onClick={() => setIsMixtureModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              Mixture
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WIP Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Work-In-Progress Items</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{
                  borderColor: activeBusiness?.primary_color || "#7c3aed",
                }}
              ></div>
              <span className="ml-3 text-gray-600">
                Loading WIP inventory...
              </span>
            </div>
          ) : filteredWipItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No WIP items found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm
                  ? "No items match your search criteria."
                  : "There are currently no items in work-in-progress inventory."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <CustomTable1 data={filteredWipItems} fields={wipfields} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Production Orders */}

      {/* Mixture Modal */}
      <MixtureModal
        isOpen={isMixtureModalOpen}
        onClose={() => {
          setIsMixtureModalOpen(false);
          setMixtureRefreshKey((k) => k + 1);
          fetchWipInventory();
        }}
      />

      {/* Mixture History Modal */}
      <Dialog open={isMixtureHistoryOpen} onOpenChange={setIsMixtureHistoryOpen}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[var(--aa-navy)]" />
              Mixture History
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <MixtureHistory key={`modal-${mixtureRefreshKey}`} />
          </div>
        </DialogContent>
      </Dialog>

      {/* WIP Action Modal */}
      <Dialog
        open={isWipActionOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeWipActionDialog();
          } else {
            setIsWipActionOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {wipActionType === "return_raw_material"
                ? "Return to Raw Material"
                : "Write-off (Scrap/Loss)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">Item:</span>{" "}
              {wipActionItem?.name || "-"} ({wipActionItem?.sku || "-"})
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-semibold">Available WIP:</span>{" "}
              {formatNumber(Number(wipActionItem?.balance || 0))}
            </div>
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={wipActionQty}
                onChange={(e) => setWipActionQty(e.target.value)}
                placeholder="Enter quantity"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                type="text"
                value={wipActionNotes}
                onChange={(e) => setWipActionNotes(e.target.value)}
                placeholder="Reason / remark"
                className="mt-1"
              />
            </div>
            {(wipActionType === "write_off" || wipActionType === "return_raw_material") && (
              <div>
                <label className="text-sm font-medium">
                  {wipActionType === "write_off"
                    ? "Chart of Account Head (Loss / Expense)"
                    : "WIP Account Head"}
                </label>
                <div className="mt-1 relative">
                  {selectedAccountOption ? (
                    /* Selected chip */
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
                        onBlur={() => setTimeout(() => setAccountOpen(false), 150)}
                        placeholder={
                          accountsLoading
                            ? "Loading accounts..."
                            : "Type code or name to search..."
                        }
                        disabled={accountsLoading || wipActionSubmitting}
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
                                <span className="font-mono text-xs text-gray-400 shrink-0 w-20">
                                  {acc.head}
                                </span>
                                <span className="flex-1 text-gray-800">{acc.description}</span>
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
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={closeWipActionDialog}
                disabled={wipActionSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={submitWipAction} disabled={wipActionSubmitting}>
                {wipActionSubmitting ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* WIP Action History Modal */}
      <Dialog open={isWipHistoryOpen} onOpenChange={setIsWipHistoryOpen}>
        <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-[var(--aa-navy)]" />
              WIP Action History
            </DialogTitle>
          </DialogHeader>
          {wipHistoryLoading ? (
            <div className="py-8 text-center text-sm text-gray-600">Loading history...</div>
          ) : wipActionHistory.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No history found yet.
            </div>
          ) : (
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Reference</th>
                    <th className="px-3 py-2 text-left font-semibold">Item</th>
                    <th className="px-3 py-2 text-left font-semibold">Action</th>
                    <th className="px-3 py-2 text-right font-semibold">Quantity</th>
                    <th className="px-3 py-2 text-right font-semibold">Unit Cost</th>
                    <th className="px-3 py-2 text-right font-semibold">Total Cost</th>
                    <th className="px-3 py-2 text-left font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {wipActionHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        {row.created_at
                          ? moment(row.created_at).format("YYYY-MM-DD HH:mm")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.reference_number || "-"}</td>
                      <td className="px-3 py-2">
                        {row.product_name || row.product_id || "-"} ({row.product_id || "-"})
                      </td>
                      <td className="px-3 py-2">
                        {row.action_type === "return_raw_material"
                          ? "Return to Raw Material"
                          : "Write-off (Scrap/Loss)"}
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(row.quantity || 0)}</td>
                      <td className="px-3 py-2 text-right">₦{formatNumber(row.unit_cost || 0)}</td>
                      <td className="px-3 py-2 text-right">₦{formatNumber(row.total_cost || 0)}</td>
                      <td className="px-3 py-2">{row.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
