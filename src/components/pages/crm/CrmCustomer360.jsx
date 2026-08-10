import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { useSelector } from "react-redux";
import { _fetchApi, _postApi, _putApi } from "@/redux/actions/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  useCrmFacilityId,
  formatNaira,
  CRM_STATUSES,
  statusBadgeClass,
} from "./CrmLayout";

export default function CrmCustomer360() {
  const { customerNo } = useParams();
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: "note",
    subject: "",
    body: "",
  });
  const [followForm, setFollowForm] = useState({
    title: "",
    notes: "",
    due_at: "",
  });

  const load = useCallback(() => {
    if (!facilityId || !customerNo) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/customers/${encodeURIComponent(customerNo)}?facilityId=${facilityId}`,
      (res) => {
        setData(res?.results || null);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load customer");
        setLoading(false);
      },
    );
    _fetchApi(
      `/api/v1/crm/customers/${encodeURIComponent(customerNo)}/timeline?facilityId=${facilityId}`,
      (res) => setTimeline(res?.results || []),
      () => {},
    );
  }, [facilityId, customerNo]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMeta = (patch) => {
    _putApi(
      `/api/v1/crm/customers/${encodeURIComponent(customerNo)}/meta?facilityId=${facilityId}`,
      { facilityId, ...patch },
      () => {
        toast.success("Updated");
        load();
      },
      (err) => toast.error(err?.error || "Update failed"),
    );
  };

  const createActivity = () => {
    _postApi(
      `/api/v1/crm/activities`,
      {
        facilityId,
        customer_no: customerNo,
        ...activityForm,
        created_by: user?.id,
      },
      () => {
        toast.success("Activity logged");
        setActivityOpen(false);
        setActivityForm({ activity_type: "note", subject: "", body: "" });
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  const createFollowup = () => {
    if (!followForm.title || !followForm.due_at) {
      toast.error("Title and due date required");
      return;
    }
    _postApi(
      `/api/v1/crm/followups`,
      {
        facilityId,
        customer_no: customerNo,
        ...followForm,
        created_by: user?.id,
      },
      () => {
        toast.success("Follow-up scheduled");
        setFollowOpen(false);
        setFollowForm({ title: "", notes: "", due_at: "" });
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  if (loading && !data) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const c = data?.customer || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/app/crm/customers"
            className="mb-2 inline-flex items-center text-sm text-[#4267B2] hover:underline"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to customers
          </Link>
          <h2 className="text-2xl font-semibold text-[#1a2d5e]">
            {c.customer_name || customerNo}
          </h2>
          <p className="text-sm text-slate-500">
            {c.customerNo || customerNo}
            {c.mobile || c.phone ? ` · ${c.mobile || c.phone}` : ""}
            {c.email ? ` · ${c.email}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={c.crm_status || "New"}
            onChange={(e) => saveMeta({ crm_status: e.target.value })}
          >
            {CRM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Log activity
          </Button>
          <Button
            size="sm"
            className="bg-[#1a2d5e] hover:bg-[#15254d]"
            onClick={() => setFollowOpen(true)}
          >
            Schedule follow-up
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total sales", value: formatNaira(c.total_sales) },
          { label: "Invoices", value: c.invoice_count || 0 },
          { label: "Outstanding", value: formatNaira(c.outstanding) },
          { label: "Overdue", value: formatNaira(c.overdue) },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {m.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#1a2d5e]">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-[#1a2d5e]">Profile</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">CRM status</dt>
                <dd>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${statusBadgeClass(c.crm_status)}`}
                  >
                    {c.crm_status}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">First purchase</dt>
                <dd>
                  {c.first_purchase
                    ? moment(c.first_purchase).format("DD MMM YYYY")
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Last purchase</dt>
                <dd>
                  {c.last_purchase
                    ? moment(c.last_purchase).format("DD MMM YYYY")
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Segment</dt>
                <dd>{c.segment_key || "—"}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <label className="text-xs font-medium text-slate-500">
                CRM notes
              </label>
              <textarea
                className="mt-1 min-h-[90px] w-full rounded-md border p-2 text-sm"
                defaultValue={c.crm_notes || ""}
                onBlur={(e) => {
                  if (e.target.value !== (c.crm_notes || "")) {
                    saveMeta({ notes: e.target.value });
                  }
                }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-[#1a2d5e]">Recent invoices</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {(data?.recentInvoices || []).map((inv) => (
                <li
                  key={inv.invoice_ref}
                  className="flex items-center justify-between border-b border-slate-100 pb-2"
                >
                  <div>
                    <div className="font-medium text-slate-800">
                      {inv.invoice_ref}
                    </div>
                    <div className="text-xs text-slate-400">
                      {moment(inv.transaction_date).format("DD MMM YYYY")}
                    </div>
                  </div>
                  <div className="font-medium">{formatNaira(inv.amount)}</div>
                </li>
              ))}
              {!data?.recentInvoices?.length ? (
                <li className="text-slate-500">No sales invoices yet.</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a2d5e]/10 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="font-semibold text-[#1a2d5e]">Timeline</h3>
          <ul className="mt-4 space-y-3">
            {timeline.map((ev, idx) => (
              <li
                key={`${ev.type}-${ev.id}-${idx}`}
                className="flex gap-3 border-b border-slate-100 pb-3"
              >
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#4267B2]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {ev.type}
                      {ev.subtype ? ` · ${ev.subtype}` : ""}
                    </span>
                    <span className="text-xs text-slate-400">
                      {ev.at ? moment(ev.at).format("DD MMM YYYY HH:mm") : ""}
                    </span>
                  </div>
                  <p className="font-medium text-slate-800">{ev.title}</p>
                  {ev.body ? (
                    <p className="text-sm text-slate-500 line-clamp-3">{ev.body}</p>
                  ) : null}
                  {ev.amount != null ? (
                    <p className="text-sm text-slate-600">
                      {formatNaira(ev.amount)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
            {!timeline.length ? (
              <li className="text-slate-500">No timeline events yet.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Log activity</SheetTitle>
            <SheetDescription>Record a call, meeting, note, or task.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={activityForm.activity_type}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, activity_type: e.target.value }))
              }
            >
              {["call", "meeting", "note", "task", "email", "other"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Input
              placeholder="Subject"
              value={activityForm.subject}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, subject: e.target.value }))
              }
            />
            <textarea
              className="min-h-[120px] w-full rounded-md border p-3 text-sm"
              placeholder="Details"
              value={activityForm.body}
              onChange={(e) =>
                setActivityForm((f) => ({ ...f, body: e.target.value }))
              }
            />
            <Button className="w-full bg-[#1a2d5e]" onClick={createActivity}>
              Save activity
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={followOpen} onOpenChange={setFollowOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Schedule follow-up</SheetTitle>
            <SheetDescription>Set a reminder to reconnect.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <Input
              placeholder="Title"
              value={followForm.title}
              onChange={(e) =>
                setFollowForm((f) => ({ ...f, title: e.target.value }))
              }
            />
            <Input
              type="datetime-local"
              value={followForm.due_at}
              onChange={(e) =>
                setFollowForm((f) => ({ ...f, due_at: e.target.value }))
              }
            />
            <textarea
              className="min-h-[100px] w-full rounded-md border p-3 text-sm"
              placeholder="Notes"
              value={followForm.notes}
              onChange={(e) =>
                setFollowForm((f) => ({ ...f, notes: e.target.value }))
              }
            />
            <Button className="w-full bg-[#1a2d5e]" onClick={createFollowup}>
              Schedule
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
