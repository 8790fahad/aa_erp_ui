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
  FlaskConical,
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

const MixtureHistory = () => {
  const activeBusiness = useSelector((state) => state.auth.activeBusiness);
  const [mixtures, setMixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const fetchMixtures = useCallback(() => {
    if (!activeBusiness?.id) return;
    setLoading(true);
    _fetchApi(
      `/inventory/mixtures?facilityId=${activeBusiness.id}`,
      (resp) => {
        setLoading(false);
        if (resp.success) {
          setMixtures(resp.data || []);
        } else {
          toast.error(resp.message || "Failed to load mixtures");
        }
      },
      (err) => {
        setLoading(false);
        console.error(err);
        toast.error("Error loading mixture history");
      }
    );
  }, [activeBusiness?.id]);

  useEffect(() => {
    fetchMixtures();
  }, [fetchMixtures]);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-[#4267B2]" />
          Mixture History
          {mixtures.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {mixtures.length}
            </Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchMixtures}
          disabled={loading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && mixtures.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-500">
            Loading mixture history...
          </div>
        ) : mixtures.length === 0 ? (
          <div className="text-center py-10">
            <FlaskConical className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-900">
              No mixtures yet
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Create a mixture from the WIP page to see it here.
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
                    Semi-finished
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Qty Produced
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    Total Cost
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#4267B2] uppercase tracking-wider">
                    By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mixtures.map((m, idx) => {
                  const isOpen = expandedId === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        className={`hover:bg-blue-50/30 cursor-pointer transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                        }`}
                        onClick={() => toggleExpand(m.id)}
                      >
                        <td className="px-2 py-2.5 text-center">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-[#4267B2]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#4267B2]">
                          {m.reference_number}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">
                          {moment(m.created_at).format("DD MMM YYYY HH:mm")}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-gray-900">
                            {m.product_name}
                          </div>
                          {m.product_sku && (
                            <div className="text-[10px] text-gray-500">
                              {m.product_sku}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {fmt(m.quantity_produced)}{" "}
                          <span className="text-[10px] text-gray-500">
                            {m.unit_of_measure}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-[#4267B2] font-semibold">
                          ₦{fmt(m.unit_cost)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold">
                          ₦{fmt(m.total_ingredients_cost)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          {m.created_by || "—"}
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="bg-[#4267B2]/[0.04]">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 gap-4 mb-3 text-xs">
                              <div>
                                <span className="font-semibold text-gray-700">
                                  Inventory account:
                                </span>{" "}
                                <span className="font-mono">
                                  {m.inventory_account || "—"}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-gray-700">
                                  WIP account:
                                </span>{" "}
                                <span className="font-mono">
                                  {m.wip_account || "—"}
                                </span>
                              </div>
                            </div>

                            <div className="text-xs font-semibold text-gray-700 mb-1.5">
                              Ingredients consumed
                            </div>
                            <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                              <table className="min-w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">
                                      Product
                                    </th>
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">
                                      SKU
                                    </th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">
                                      Qty
                                    </th>
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">
                                      Unit
                                    </th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">
                                      Unit Cost
                                    </th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {(m.ingredients || []).length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-3 py-3 text-center text-gray-400 italic"
                                      >
                                        No ingredient breakdown stored.
                                      </td>
                                    </tr>
                                  ) : (
                                    (m.ingredients || []).map((ing) => (
                                      <tr key={ing.id}>
                                        <td className="px-3 py-1.5">
                                          {ing.product_name}
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-[10px]">
                                          {ing.product_sku}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                          {fmt(ing.quantity)}
                                        </td>
                                        <td className="px-3 py-1.5">
                                          {ing.unit_of_measure || "—"}
                                        </td>
                                        <td className="px-3 py-1.5 text-right">
                                          ₦{fmt(ing.unit_cost)}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-semibold">
                                          ₦{fmt(ing.total_cost)}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
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
    </Card>
  );
};

export default MixtureHistory;
