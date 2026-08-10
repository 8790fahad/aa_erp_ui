import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { Plus } from "lucide-react";
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
import SearchCustomerInput from "@/components/pages/customer/components/SearchCustomerInput";
import { useCrmFacilityId } from "./CrmLayout";

export default function CrmFollowups() {
  const facilityId = useCrmFacilityId();
  const user = useSelector((s) => s.auth?.user);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_no: "",
    title: "",
    notes: "",
    due_at: "",
  });

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    const q = new URLSearchParams({ facilityId, limit: "150" });
    if (filter) q.set("status", filter);
    _fetchApi(
      `/api/v1/crm/followups?${q}`,
      (res) => {
        setRows(res?.results || []);
        setLoading(false);
      },
      (err) => {
        toast.error(err?.error || "Failed to load follow-ups");
        setLoading(false);
      },
    );
  }, [facilityId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    if (!form.customer_no || !form.title || !form.due_at) {
      toast.error("Customer, title, and due date required");
      return;
    }
    _postApi(
      `/api/v1/crm/followups`,
      { facilityId, ...form, created_by: user?.id },
      () => {
        toast.success("Follow-up created");
        setOpen(false);
        setForm({ customer_no: "", title: "", notes: "", due_at: "" });
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  const markDone = (id) => {
    _putApi(
      `/api/v1/crm/followups/${id}?facilityId=${facilityId}`,
      { facilityId, status: "done" },
      () => {
        toast.success("Marked done");
        load();
      },
      (err) => toast.error(err?.error || "Failed"),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1a2d5e]">Follow-ups</h2>
          <p className="text-sm text-slate-500">Scheduled customer reconnects.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded-md border px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button
            size="sm"
            className="bg-[#1a2d5e] hover:bg-[#15254d]"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New follow-up
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#1a2d5e]/10 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#1a2d5e]/5 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-3 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {moment(r.due_at).format("DD MMM YYYY HH:mm")}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/app/crm/customers/${encodeURIComponent(r.customer_no)}`}
                        className="text-[#1a2d5e] hover:underline"
                      >
                        {r.customer_no}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.title}</div>
                      {r.notes ? (
                        <div className="line-clamp-1 text-xs text-slate-400">
                          {r.notes}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 capitalize">{r.status}</td>
                    <td className="px-3 py-2 text-right">
                      {r.status === "pending" || r.status === "overdue" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markDone(r.id)}
                        >
                          Done
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No follow-ups.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New follow-up</SheetTitle>
            <SheetDescription>Schedule a reminder for a customer.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <SearchCustomerInput
              onChange={(c) =>
                setForm((f) => ({
                  ...f,
                  customer_no: c?.customerNo || c?.customer_no || "",
                }))
              }
            />
            <Input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <Input
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
            />
            <textarea
              className="min-h-[100px] w-full rounded-md border p-3 text-sm"
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <Button className="w-full bg-[#1a2d5e]" onClick={save}>
              Create
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
