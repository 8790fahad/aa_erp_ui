import { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { toast } from "sonner";
import { RefreshCw, Star } from "lucide-react";
import { _fetchApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrmFacilityId } from "./CrmLayout";

function Stars({ value }) {
  const n = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-0.5" title={`${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= n ? "fill-amber-400 text-amber-400" : "text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * CRM view of customer feedback submitted via Goods Issue Note QR.
 */
export default function CrmFeedback() {
  const facilityId = useCrmFacilityId();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/customer-feedback?businessId=${encodeURIComponent(facilityId)}`,
      (res) => {
        setLoading(false);
        if (res?.success) {
          setRows(Array.isArray(res.results) ? res.results : []);
        } else {
          toast.error(res?.message || "Failed to load feedback");
          setRows([]);
        }
      },
      (err) => {
        setLoading(false);
        toast.error(err?.message || "Failed to load feedback");
        setRows([]);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.sale_code, r.customer_name, r.customer_no, r.comment, r.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const avgRating = useMemo(() => {
    const rated = rows.filter((r) => Number(r.rating) > 0);
    if (!rated.length) return null;
    const sum = rated.reduce((s, r) => s + Number(r.rating), 0);
    return (sum / rated.length).toFixed(1);
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">Feedback</h2>
          <p className="text-sm text-slate-500">
            Feedback submitted from Goods Issue Note QR scans.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-1 text-2xl font-bold text-[#1a2d5e]">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Avg rating
          </p>
          <p className="mt-1 text-2xl font-bold text-[#1a2d5e]">
            {avgRating ?? "—"}
          </p>
        </div>
        <div className="col-span-2 rounded-xl border border-[#1a2d5e]/10 bg-white px-4 py-3 shadow-sm sm:col-span-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Search
          </label>
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Invoice, customer, comment…"
            className="mt-1 h-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#1a2d5e]/10 bg-white shadow-sm">
        {loading && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-14 text-center text-sm text-slate-500">
            {rows.length === 0
              ? "No feedback yet. Customers can submit via the Goods Issue Note QR."
              : "No feedback matches your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Comment</th>
                  <th className="px-4 py-3">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {r.created_at
                        ? moment(r.created_at).format("DD MMM YYYY HH:mm")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-[#1a2d5e]">
                      {r.sale_code || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1a2d5e]">
                        {r.customer_name || "—"}
                      </div>
                      {r.customer_no ? (
                        <div className="text-xs text-slate-500">
                          {r.customer_no}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {r.rating != null ? <Stars value={r.rating} /> : "—"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      <p className="line-clamp-3 whitespace-pre-wrap">
                        {r.comment || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {r.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
