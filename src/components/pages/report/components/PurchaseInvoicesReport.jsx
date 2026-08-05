import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { _fetchApi } from "@/redux/actions/api";
import { formatNumber1 } from "@/components/router/utilities";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import moment from "moment";

const PAGE_SIZE = 100;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function PurchaseInvoicesReport() {
  const { activeBusiness } = useSelector((state) => state.auth);
  const facilityId = activeBusiness?.id;
  const navigate = useNavigate();
  const location = useLocation();

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const defaultFrom = new Date(today.getFullYear(), 0, 1)
      .toISOString()
      .split("T")[0];
    setFromDate(location.state?.fromDate || defaultFrom);
    setToDate(location.state?.toDate || todayStr);
  }, [location.state]);

  const runFetch = useCallback(async () => {
    if (!facilityId || !fromDate || !toDate) return;
    setLoading(true);
    setError("");
    try {
      const [allPurchases, supplierRes] = await Promise.all([
        fetchAllPurchaseInvoices(facilityId),
        fetchSuppliers(facilityId),
      ]);
      const supplierMap = new Map(
        supplierRes.map((s) => [String(s.supplier_number || s.id), s.supplier_name || s.name]),
      );

      const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
      const toTs = new Date(`${toDate}T23:59:59`).getTime();

      const mapped = allPurchases
        .filter((inv) => {
          const dt = inv.transaction_date || inv.invoice_date || inv.created_at;
          if (!dt) return false;
          const ts = new Date(dt).getTime();
          return Number.isFinite(ts) && ts >= fromTs && ts <= toTs;
        })
        .map((inv) => {
          const amount = toNum(inv.amount || inv.total);
          return {
            invoiceNo: inv.invoice_ref || "-",
            supplierNo: inv.ref_number || "-",
            supplier: supplierMap.get(String(inv.ref_number || "")) || inv.ref_number || "-",
            date: inv.transaction_date || inv.invoice_date || "",
            dueDate: inv.due_date || "",
            amount,
          };
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setRows(mapped);
    } catch (e) {
      console.error(e);
      setError("Unable to load purchase invoice report");
      toast.error("Unable to load purchase invoice report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [facilityId, fromDate, toDate]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  const totalAmount = useMemo(
    () => rows.reduce((sum, r) => sum + r.amount, 0),
    [rows],
  );

  const periodLabel = useMemo(() => {
    if (!fromDate || !toDate) return "";
    const sameYear = moment(fromDate).year() === moment(toDate).year();
    if (sameYear) {
      return `${moment(fromDate).format("MMMM")} - ${moment(toDate).format("MMMM YYYY")}`;
    }
    return `${moment(fromDate).format("MMMM YYYY")} - ${moment(toDate).format("MMMM YYYY")}`;
  }, [fromDate, toDate]);

  return (
    <div className="space-y-3">
      <div className="bg-gray-100 rounded-lg px-2 py-2 no-print">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div>
              <label className="text-xs text-gray-600 block mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              />
            </div>
            <Button onClick={runFetch} disabled={loading || !facilityId}>
              {loading ? "Loading..." : "Run Report"}
            </Button>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => navigate("/app/reports/accounting-reports")}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b bg-white">
            <h2 className="text-2xl font-bold text-blue-900">Purchase Invoices Report</h2>
            <p className="text-sm text-slate-600 mt-1">
              Period: {periodLabel} · All amounts in ₦
            </p>
          </div>
          <div className="px-6 py-4 flex justify-between text-sm text-gray-700">
            <p className="font-semibold">Invoice details</p>
            <p>{rows.length} invoices</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-600 text-white">
                  <th className="text-left py-3 px-6 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Invoice #
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Supplier
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide border-b border-slate-500 whitespace-nowrap min-w-[90px]">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide border-b border-slate-500 whitespace-nowrap min-w-[110px]">
                    Due Date
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-semibold uppercase tracking-wide border-b border-slate-500">
                    Amount (₦)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={`${r.invoiceNo}-${idx}`} className="border-b">
                    <td className="py-3 px-6 font-semibold">{r.invoiceNo}</td>
                    <td className="py-3 px-3">
                      <span className="block">{r.supplier}</span>
                      <span className="text-xs text-gray-500">{r.supplierNo}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.date ? moment(r.date).format("MMM D") : "-"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.dueDate ? moment(r.dueDate).format("MMM D") : "-"}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold">
                      {formatNumber1(r.amount)}
                    </td>
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="bg-white font-semibold border-t">
                    <td className="py-4 px-6" colSpan={4}>
                      Total
                    </td>
                    <td className="py-4 px-3 text-right">{formatNumber1(totalAmount)}</td>
                  </tr>
                )}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-gray-500">
                      No purchase invoices found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchAllPurchaseInvoices(facilityId) {
  let page = 1;
  let all = [];
  let totalCount = Infinity;
  while (all.length < totalCount) {
    const batch = await fetchPurchasePage(facilityId, page, PAGE_SIZE);
    all = all.concat(batch.rows);
    totalCount = Number.isFinite(batch.totalCount) ? batch.totalCount : all.length;
    if (!batch.rows.length) break;
    page += 1;
  }
  return all;
}

function fetchPurchasePage(facilityId, page, pageSize) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      facilityId: String(facilityId),
      type: "purchase",
      page: String(page),
      pageSize: String(pageSize),
    });
    _fetchApi(
      `/api/v1/transactions/get-all-transactions-data?${params.toString()}`,
      (res) => {
        if (res?.success) {
          resolve({
            rows: Array.isArray(res.results) ? res.results : [],
            totalCount: toNum(res.totalCount),
          });
        } else {
          reject(new Error(res?.message || "Failed to fetch purchase invoices"));
        }
      },
      (err) => reject(err),
    );
  });
}

function fetchSuppliers(facilityId) {
  return new Promise((resolve, reject) => {
    _fetchApi(
      `/api/suppliers?facilityId=${encodeURIComponent(facilityId)}&limit=1000`,
      (res) => {
        if (res?.success) {
          const items = res?.data?.suppliers || res?.data || [];
          resolve(Array.isArray(items) ? items : []);
        } else {
          reject(new Error(res?.message || "Failed to fetch suppliers"));
        }
      },
      (err) => reject(err),
    );
  });
}

