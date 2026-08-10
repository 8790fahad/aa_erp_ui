import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Users, PhoneCall, AlertTriangle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { _fetchApi, _postApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCrmFacilityId,
  formatNaira,
  CRM_STATUSES,
  statusBadgeClass,
} from "./CrmLayout";

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[#1a2d5e]">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
        </div>
        <div className="rounded-lg bg-[#4267B2]/10 p-2 text-[#4267B2]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function CrmDashboard() {
  const facilityId = useCrmFacilityId();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [classifying, setClassifying] = useState(false);

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/dashboard?facilityId=${facilityId}`,
      (res) => {
        setData(res?.results || null);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load CRM dashboard");
        setLoading(false);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const runClassify = () => {
    if (!facilityId) return;
    setClassifying(true);
    _postApi(
      `/api/v1/crm/classify`,
      { facilityId },
      (res) => {
        toast.success(
          `Classified ${res?.results?.total || 0} customers (${res?.results?.updated || 0} updated)`,
        );
        setClassifying(false);
        load();
      },
      (err) => {
        toast.error(err?.error || "Classification failed");
        setClassifying(false);
      },
    );
  };

  if (loading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const byStatus = data?.byStatus || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">Overview</h2>
          <p className="text-sm text-slate-500">
            Retention health from invoices and CRM activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-[#1a2d5e] hover:bg-[#15254d]"
            onClick={runClassify}
            disabled={classifying}
          >
            {classifying ? "Classifying…" : "Run classification"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Customers"
          value={data?.totalCustomers ?? 0}
          hint={`${data?.sales?.buyers || 0} with sales history`}
        />
        <StatCard
          icon={Wallet}
          label="Outstanding AR"
          value={formatNaira(data?.outstanding)}
          hint={`${formatNaira(data?.overdue)} overdue`}
        />
        <StatCard
          icon={PhoneCall}
          label="Activities (7d)"
          value={data?.activitiesLast7Days ?? 0}
        />
        <StatCard
          icon={AlertTriangle}
          label="Follow-ups overdue"
          value={data?.followups?.overdue ?? 0}
          hint={`${data?.followups?.upcoming || 0} upcoming`}
        />
      </div>

      <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-[#1a2d5e]">Status mix</h3>
          <Link
            to="/app/crm/customers"
            className="text-sm text-[#4267B2] hover:underline"
          >
            View customers
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {CRM_STATUSES.map((status) => (
            <Link
              key={status}
              to={`/app/crm/customers?status=${encodeURIComponent(status)}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${statusBadgeClass(status)}`}
            >
              <span>{status}</span>
              <span className="font-semibold">{byStatus[status] || 0}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-[#1a2d5e]">Sales footprint</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Total sales</dt>
              <dd className="font-medium text-slate-800">
                {formatNaira(data?.sales?.totalSales)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Sales invoices</dt>
              <dd className="font-medium text-slate-800">
                {data?.sales?.invoiceCount || 0}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
          <h3 className="font-semibold text-[#1a2d5e]">Quick links</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/app/crm/followups"
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              Follow-ups
            </Link>
            <Link
              to="/app/crm/sms"
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              Send SMS
            </Link>
            <Link
              to="/app/crm/settings"
              className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-slate-700 hover:bg-slate-50"
            >
              CRM settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
