import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { Plus } from "lucide-react";
import { _fetchApi, _postApi } from "@/redux/actions/api";
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
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import { useCrmFacilityId } from "./CrmLayout";

export default function CrmActivities() {
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_no: "",
    customer_name: "",
    activity_type: "note",
    subject: "",
    body: "",
  });

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    _fetchApi(
      `/api/v1/crm/activities?facilityId=${facilityId}&limit=150`,
      (res) => {
        setRows(res?.results || []);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load activities");
        setLoading(false);
      },
    );
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    if (!form.customer_no) {
      toast.error("Select a customer");
      return;
    }
    _postApi(
      `/api/v1/crm/activities`,
      {
        facilityId,
        customer_no: form.customer_no,
        activity_type: form.activity_type,
        subject: form.subject,
        body: form.body,
        created_by: user?.id,
      },
      () => {
        toast.success("Activity saved");
        setOpen(false);
        setForm({
          customer_no: "",
          customer_name: "",
          activity_type: "note",
          subject: "",
          body: "",
        });
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">Activities</h2>
          <p className="text-sm text-slate-500">Calls, meetings, notes, and tasks.</p>
        </div>
        <Button
          size="sm"
          className="bg-[#1a2d5e] hover:bg-[#15254d]"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Log activity
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#1a2d5e]/10 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#1a2d5e]/5 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Subject</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-3 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500">
                      {moment(r.created_at).format("DD MMM YYYY HH:mm")}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/app/crm/customers/${encodeURIComponent(r.customer_no)}`}
                        className="text-[#1a2d5e] hover:underline"
                      >
                        {r.customer_no}
                      </Link>
                    </td>
                    <td className="px-3 py-2 capitalize">{r.activity_type}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.subject || "—"}</div>
                      {r.body ? (
                        <div className="line-clamp-1 text-xs text-slate-400">
                          {r.body}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  No activities yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Log activity</SheetTitle>
            <SheetDescription>Attach an activity to a customer.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <SearchCustomerInput
              onChange={(c) =>
                setForm((f) => ({
                  ...f,
                  customer_no: c?.customerNo || c?.customer_no || "",
                  customer_name: c?.fullname || c?.customer_name || "",
                }))
              }
            />
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={form.activity_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, activity_type: e.target.value }))
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
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
            <textarea
              className="min-h-[120px] w-full rounded-md border p-3 text-sm"
              placeholder="Details"
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <Button className="w-full bg-[#1a2d5e]" onClick={save}>
              Save
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
