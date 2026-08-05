import { useState, useEffect, useCallback, Fragment } from "react";
import { useSelector } from "react-redux";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Package,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { toast } from "sonner";
import moment from "moment";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "By-Product", label: "By-Product" },
  { value: "Finished Good", label: "Finished Good" },
];

const ProductionProductEntryHistory = ({ refreshKey = 0 }) => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [sectionOpen, setSectionOpen] = useState(false);

  const fetchEntries = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    const typeParam =
      filterType === "all" ? "all" : encodeURIComponent(filterType);
    _fetchApi(
      `/inventory/production-product-entries?facilityId=${activeBusiness.id}&item_type=${typeParam}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setEntries(resp.data || []);
        } else {
          toast.error(resp.message || "Failed to load entry history");
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error("Error loading production entry history");
      },
    );
  }, [activeBusiness?.id, filterType]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, refreshKey]);

  useEffect(() => {
    if (refreshKey > 0) {
      setSectionOpen(true);
    }
  }, [refreshKey]);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const formatMarkup = (entry) => {
    const val = fmt(entry.mark_up);
    if (entry.markup_mode === "fixed") return `₦${val}`;
    return `${val}%`;
  };

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen}>
      <Card className="mb-6">
        <CollapsibleTrigger asChild>
          <CardHeader
            className="flex flex-row items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-colors rounded-t-lg"
          >
            <CardTitle className="flex items-center gap-2 text-base">
              {sectionOpen ? (
                <ChevronDown className="h-5 w-5 text-[#4267B2] shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 text-gray-400 shrink-0" />
              )}
              <Package className="h-5 w-5 text-[#4267B2]" />
              Production Entry History
              {entries.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {entries.length}
                </Badge>
              )}
              {!sectionOpen && entries.length > 0 && (
                <span className="text-xs font-normal text-gray-500 ml-1">
                  — click to expand
                </span>
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center justify-end gap-2 mb-4 pb-4 border-b border-gray-100">
              <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                {FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilterType(opt.value)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                      filterType === opt.value
                        ? "bg-white text-[#4267B2] shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchEntries}
                disabled={loading}
                className="flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-500">
            Loading entry history...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10">
            <Package className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              No production entries yet
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Add a by-product or finished good entry to see it here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#4267B2]/5 border-b border-[#4267B2]/15">
                <tr>
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Selling Price
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry, idx) => {
                  const isOpen = expandedId === entry.id;
                  const totalCost =
                    Number(entry.quantity || 0) * Number(entry.cost_price || 0);
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                        }`}
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <td className="px-2 py-2.5 text-center">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-[#4267B2]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#4267B2]">
                          {entry.reference_number}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">
                          {entry.receive_date
                            ? moment(entry.receive_date).format("DD MMM YYYY")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium"
                          >
                            {entry.entry_type}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900">
                            {entry.product_name}
                          </div>
                          {entry.product_id && (
                            <div className="text-[10px] text-gray-500 font-mono">
                              {entry.product_id}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {fmt(entry.quantity)}{" "}
                          <span className="text-[10px] text-gray-500">
                            {entry.unit_of_measure || ""}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#4267B2] font-semibold">
                          ₦{fmt(entry.cost_price)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">
                          ₦{fmt(entry.selling_price)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">
                          {entry.physical_branch_name || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {entry.inserted_by || "—"}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-[#4267B2]/[0.04]">
                          <td colSpan={10} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="font-semibold text-gray-700">
                                  Markup:
                                </span>{" "}
                                {formatMarkup(entry)}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700">
                                  Total cost:
                                </span>{" "}
                                ₦{fmt(totalCost)}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700">
                                  Inventory account:
                                </span>{" "}
                                <span className="font-mono">
                                  {entry.inventory_account_code || "—"}
                                </span>
                                {entry.inventory_account_name && (
                                  <span className="text-gray-500">
                                    {" "}
                                    ({entry.inventory_account_name})
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700">
                                  Credit account:
                                </span>{" "}
                                <span className="font-mono">
                                  {entry.credit_account_code || "—"}
                                </span>
                                {entry.credit_account_name && (
                                  <span className="text-gray-500">
                                    {" "}
                                    ({entry.credit_account_name})
                                  </span>
                                )}
                              </div>
                              {entry.notes && (
                                <div className="sm:col-span-2">
                                  <span className="font-semibold text-gray-700">
                                    Notes:
                                  </span>{" "}
                                  {entry.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default ProductionProductEntryHistory;
